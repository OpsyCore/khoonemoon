import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceRecord } from "@/features/finance/types";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const dueAt = "2026-08-27T20:00:00.000Z";
const occurredAt = "2026-08-26T08:00:00.000Z";
const userA = { id: "11111111-1111-4111-8111-111111111111" };
const userB = { id: "22222222-2222-4222-8222-222222222222" };

type RpcCall = { name: string; args: Record<string, unknown> };

type MockOptions = {
  user?: { id: string } | null;
  membership?: { household_id: string } | null;
  members?: { user_id: string; household_id: string; left_at: string | null }[];
  records?: FinanceRecord[];
  record?: FinanceRecord | null;
  deleted?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
};

function createMockSupabase(options: MockOptions) {
  const rpcCalls: RpcCall[] = [];
  const membership = options.membership ?? null;
  const members = options.members ?? [];
  const records = options.records ?? [];
  const record = options.record ?? records[0] ?? null;
  const deleted =
    options.deleted === undefined
      ? record
        ? { id: record.id }
        : null
      : options.deleted;

  function tableQuery(table: string) {
    let mode: "select" | "delete" = "select";

    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      is() {
        return query;
      },
      in() {
        return query;
      },
      order() {
        return query;
      },
      delete() {
        mode = "delete";
        return query;
      },
      async maybeSingle() {
        if (table === "household_members") {
          return { data: membership, error: null };
        }
        if (mode === "delete") {
          return { data: deleted, error: null };
        }
        return { data: record, error: null };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = null;
        if (table === "finance_records") data = records;
        if (table === "household_members") data = members;
        if (table === "profiles") data = [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };

    return query;
  }

  const client = {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from(table: string) {
      return tableQuery(table);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (options.rpcError) {
        return { data: null, error: options.rpcError };
      }
      return { data: options.rpcData ?? "rec-created", error: null };
    },
    rpcCalls,
  };

  return client;
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function read(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

function bill(overrides: Partial<FinanceRecord> = {}): FinanceRecord {
  return {
    id: "rec-1",
    record_type: "BILL",
    title: "برق",
    amount: 120000,
    currency: "IRR",
    owner_id: userA.id,
    created_by: userA.id,
    household_id: null,
    visibility: "PRIVATE",
    due_at: dueAt,
    occurred_at: null,
    paid_at: null,
    paid_by: null,
    category: null,
    note: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("finance API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("GET unauthenticated → 401", async () => {
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(401);
  });

  it("GET by id unauthenticated → 401", async () => {
    const { GET } = await import("./[id]/route");
    const result = await read(
      await GET(jsonRequest("http://localhost/api/finance/rec-1", "GET"), {
        params: Promise.resolve({ id: "rec-1" }),
      }),
    );
    expect(result.status).toBe(401);
  });

  it("POST unauthenticated → 401", async () => {
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
        }),
      ),
    );
    expect(result.status).toBe(401);
  });

  it("PATCH unauthenticated → 401", async () => {
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "unpay",
        }),
        {
          params: Promise.resolve({ id: "rec-1" }),
        },
      ),
    );
    expect(result.status).toBe(401);
  });

  it("DELETE unauthenticated → 401", async () => {
    const { DELETE } = await import("./[id]/route");
    const result = await read(
      await DELETE(
        jsonRequest("http://localhost/api/finance/rec-1", "DELETE"),
        {
          params: Promise.resolve({ id: "rec-1" }),
        },
      ),
    );
    expect(result.status).toBe(401);
  });
});

describe("finance API POST", () => {
  it("creates a valid PRIVATE BILL", async () => {
    const client = createMockSupabase({
      user: userA,
      membership: null,
      rpcData: "rec-bill",
    });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 120000,
          visibility: "PRIVATE",
          dueAt,
        }),
      ),
    );
    expect(result.status).toBe(201);
    expect(result.body.id).toBe("rec-bill");
    expect(client.rpcCalls[0]?.name).toBe("create_finance_record");
    expect(client.rpcCalls[0]?.args.p_visibility).toBe("PRIVATE");
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_owner_id");
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_household_id");
  });

  it("creates a valid PRIVATE EXPENSE", async () => {
    const client = createMockSupabase({ user: userA, membership: null });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: 50,
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(201);
    expect(client.rpcCalls[0]?.args.p_record_type).toBe("EXPENSE");
    expect(client.rpcCalls[0]?.args.p_due_at).toBeNull();
  });

  it("creates a valid SHARED BILL", async () => {
    const client = createMockSupabase({
      user: userA,
      membership: { household_id: "h1" },
    });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "آب",
          amount: 10,
          visibility: "HOUSEHOLD_SHARED",
          dueAt,
        }),
      ),
    );
    expect(result.status).toBe(201);
    expect(client.rpcCalls[0]?.args.p_visibility).toBe("HOUSEHOLD_SHARED");
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_household_id");
  });

  it("rejects BILL without dueAt", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects BILL with occurredAt", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects EXPENSE without occurredAt", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: 10,
          visibility: "PRIVATE",
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects EXPENSE with dueAt", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: 10,
          visibility: "PRIVATE",
          occurredAt,
          dueAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects a negative amount", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: -5,
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects a title longer than 180 characters", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "آ".repeat(181),
          amount: 10,
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects amount <= 0", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: 0,
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects a blank title", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "   ",
          amount: 10,
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects owner_id injection", async () => {
    const client = createMockSupabase({ user: userA });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          owner_id: userB.id,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rejects created_by injection", async () => {
    const client = createMockSupabase({ user: userA });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          created_by: userB.id,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rejects household_id injection", async () => {
    const client = createMockSupabase({ user: userA });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          household_id: "h-forged",
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rejects paid_at injection", async () => {
    const client = createMockSupabase({ user: userA });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          paid_at: dueAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rejects paid_by injection", async () => {
    const client = createMockSupabase({ user: userA });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "برق",
          amount: 10,
          visibility: "PRIVATE",
          dueAt,
          paid_by: userA.id,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("rejects invalid JSON", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        new Request("http://localhost/api/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects INCOME and SAVING record types", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    for (const recordType of ["INCOME", "SAVING"]) {
      const result = await read(
        await POST(
          jsonRequest("http://localhost/api/finance", "POST", {
            recordType,
            title: "forbidden",
            amount: 10,
            visibility: "PRIVATE",
            occurredAt,
          }),
        ),
      );
      expect(result.status).toBe(400);
    }
  });

  it("rejects amount as a string", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "EXPENSE",
          title: "نان",
          amount: "10",
          visibility: "PRIVATE",
          occurredAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects shared finance without household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/finance", "POST", {
          recordType: "BILL",
          title: "آب",
          amount: 10,
          visibility: "HOUSEHOLD_SHARED",
          dueAt,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });
});

describe("finance API PATCH", () => {
  it("updates valid fields", async () => {
    const client = createMockSupabase({
      user: userA,
      record: bill(),
      rpcData: true,
    });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { title: "قبض گاز" },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(200);
    expect(client.rpcCalls[0]?.name).toBe("update_finance_record");
    expect(client.rpcCalls[0]?.args.p_title).toBe("قبض گاز");
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_record_type");
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_visibility");
  });

  it("rejects record_type mutation", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { recordType: "EXPENSE" },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects visibility mutation", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { visibility: "HOUSEHOLD_SHARED" },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects owner_id mutation", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { owner_id: userB.id },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects created_by mutation", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { created_by: userB.id },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects household_id mutation", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { household_id: "h-forged" },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects paid_at mutation on update", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { paid_at: dueAt },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("rejects paid_by mutation on update", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "update",
          data: { paid_by: userA.id },
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("pays a bill", async () => {
    const client = createMockSupabase({
      user: userA,
      record: bill(),
      rpcData: true,
    });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(200);
    expect(client.rpcCalls[0]).toEqual({
      name: "set_finance_record_paid",
      args: { p_id: "rec-1", p_paid: true, p_paid_by: userA.id },
    });
    expect(client.rpcCalls[0]?.args).not.toHaveProperty("p_paid_at");
  });

  it("rejects paying an expense", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        record: bill({
          record_type: "EXPENSE",
          due_at: null,
          occurred_at: occurredAt,
        }),
      }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("قبض");
  });

  it("unpays a bill", async () => {
    const client = createMockSupabase({
      user: userA,
      record: bill({ paid_at: dueAt, paid_by: userA.id }),
      rpcData: true,
    });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "unpay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(200);
    expect(client.rpcCalls[0]?.args).toEqual({
      p_id: "rec-1",
      p_paid: false,
      p_paid_by: null,
    });
  });

  it("rejects arbitrary paid_at on pay", async () => {
    const client = createMockSupabase({ user: userA, record: bill() });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
          paid_at: dueAt,
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("returns 404 when the record is missing", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: null }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-missing", "PATCH", {
          action: "update",
          data: { title: "قبض گاز" },
        }),
        { params: Promise.resolve({ id: "rec-missing" }) },
      ),
    );
    expect(result.status).toBe(404);
  });

  it("rejects invalid JSON", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        new Request("http://localhost/api/finance/rec-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("pays an already-paid bill", async () => {
    const client = createMockSupabase({
      user: userA,
      record: bill({ paid_at: dueAt, paid_by: userA.id }),
      rpcData: true,
    });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(200);
    expect(client.rpcCalls[0]?.args.p_paid).toBe(true);
  });

  it("unpays an unpaid bill", async () => {
    const client = createMockSupabase({
      user: userA,
      record: bill(),
      rpcData: true,
    });
    mockCreateClient.mockResolvedValue(client);
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "unpay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(200);
    expect(client.rpcCalls[0]?.args.p_paid).toBe(false);
  });

  it("returns 404 when paying a missing record", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: null }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-missing", "PATCH", {
          action: "pay",
        }),
        { params: Promise.resolve({ id: "rec-missing" }) },
      ),
    );
    expect(result.status).toBe(404);
  });

  it("maps FINANCE_ACCESS_DENIED from pay RPC", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        record: bill(),
        rpcError: { message: "FINANCE_ACCESS_DENIED" },
      }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(result.status).toBe(403);
  });

  it("rejects invalid paidBy", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, record: bill() }),
    );
    const { PATCH } = await import("./[id]/route");
    const invalidUuid = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
          paidBy: "not-a-uuid",
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(invalidUuid.status).toBe(400);

    const otherUser = await read(
      await PATCH(
        jsonRequest("http://localhost/api/finance/rec-1", "PATCH", {
          action: "pay",
          paidBy: userB.id,
        }),
        { params: Promise.resolve({ id: "rec-1" }) },
      ),
    );
    expect(otherUser.status).toBe(400);
  });
});

describe("finance API DELETE", () => {
  it("deletes an authorized record", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        record: bill(),
        deleted: { id: "rec-1" },
      }),
    );
    const { DELETE } = await import("./[id]/route");
    const result = await read(
      await DELETE(
        jsonRequest("http://localhost/api/finance/rec-1", "DELETE"),
        {
          params: Promise.resolve({ id: "rec-1" }),
        },
      ),
    );
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });

  it("denies cross-household delete as not found", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, record: null, deleted: null }),
    );
    const { DELETE } = await import("./[id]/route");
    const result = await read(
      await DELETE(
        jsonRequest("http://localhost/api/finance/rec-1", "DELETE"),
        {
          params: Promise.resolve({ id: "rec-1" }),
        },
      ),
    );
    expect(result.status).toBe(404);
  });
});

describe("finance API GET", () => {
  it("returns PRIVATE records only when supplied by RLS as owner records", async () => {
    const privateRecord = bill();
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: null,
        records: [privateRecord],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.records).toHaveLength(1);
    expect(result.body.records[0].visibility).toBe("PRIVATE");
    expect(result.body.records[0].owner_id).toBe(userA.id);
  });

  it("returns SHARED records for an active household member", async () => {
    const shared = bill({
      visibility: "HOUSEHOLD_SHARED",
      household_id: "h1",
      owner_id: userA.id,
    });
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h1" },
        members: [
          { user_id: userA.id, household_id: "h1", left_at: null },
          { user_id: userB.id, household_id: "h1", left_at: null },
        ],
        records: [shared],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.records[0].household_id).toBe("h1");
  });

  it("returns a single accessible record by id", async () => {
    const privateRecord = bill();
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        record: privateRecord,
      }),
    );
    const { GET } = await import("./[id]/route");
    const result = await read(
      await GET(jsonRequest("http://localhost/api/finance/rec-1", "GET"), {
        params: Promise.resolve({ id: "rec-1" }),
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body.record.id).toBe("rec-1");
    expect(result.body.record.record_type).toBe("BILL");
  });

  it("returns 404 for an inaccessible record id", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, record: null }),
    );
    const { GET } = await import("./[id]/route");
    const result = await read(
      await GET(jsonRequest("http://localhost/api/finance/rec-1", "GET"), {
        params: Promise.resolve({ id: "rec-1" }),
      }),
    );
    expect(result.status).toBe(404);
  });

  it("does not return unrelated household records", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h2" },
        records: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.records).toEqual([]);
  });
});
