import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const userA = { id: "11111111-1111-4111-8111-111111111111" };
const userB = { id: "22222222-2222-4222-8222-222222222222" };

type MockOptions = {
  user?: { id: string } | null;
  membership?: { household_id: string; role?: string } | null;
  memberIds?: string[];
  chores?: unknown[];
  recurrences?: unknown[];
  rotations?: unknown[];
  chore?: Record<string, unknown> | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
};

function createMockSupabase(options: MockOptions) {
  function tableQuery(table: string) {
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
      update() {
        return query;
      },
      async maybeSingle() {
        if (table === "household_members") {
          return { data: options.membership ?? null, error: null };
        }
        if (table === "chores") {
          return { data: options.chore ?? null, error: null };
        }
        return { data: null, error: null };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        if (table === "chores") data = options.chores ?? [];
        if (table === "chore_recurrences") data = options.recurrences ?? [];
        if (table === "chore_rotations") data = options.rotations ?? [];
        if (table === "household_members") {
          data = (options.memberIds ?? []).map((user_id) => ({ user_id }));
        }
        if (table === "profiles") data = [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: options.user ?? null } }),
    },
    from(table: string) {
      return tableQuery(table);
    },
    async rpc() {
      if (options.rpcError) return { data: null, error: options.rpcError };
      return { data: options.rpcData ?? "chore-1", error: null };
    },
  };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

const createPayload = {
  title: "شستن ظرف‌ها",
  startDate: "2026-08-20",
  recurrence: { frequency: "DAILY" },
  rotationUserIds: [],
};

describe("chores API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("GET unauthenticated → 401", async () => {
    const { GET } = await import("./route");
    expect((await read(await GET())).status).toBe(401);
  });

  it("POST unauthenticated → 401", async () => {
    const { POST } = await import("./route");
    expect(
      (
        await read(
          await POST(
            jsonRequest("http://localhost/api/chores", "POST", createPayload),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("GET by id unauthenticated → 401", async () => {
    const { GET } = await import("./[id]/route");
    expect(
      (
        await read(
          await GET(jsonRequest("http://localhost/api/chores/c1", "GET"), {
            params: Promise.resolve({ id: "c1" }),
          }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("chores API authorization", () => {
  it("returns empty chores when the user has no household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.chores).toEqual([]);
    expect(result.body.householdId).toBeNull();
  });

  it("does not return another household's chores when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h2" },
        memberIds: [userB.id],
        chores: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.chores).toEqual([]);
  });

  it("rejects creating a chore without a household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/chores", "POST", createPayload),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });

  it("returns 404 when a chore is not visible to the caller", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, chore: null }),
    );
    const { GET } = await import("./[id]/route");
    const result = await read(
      await GET(jsonRequest("http://localhost/api/chores/c1", "GET"), {
        params: Promise.resolve({ id: "c1" }),
      }),
    );
    expect(result.status).toBe(404);
  });
});
