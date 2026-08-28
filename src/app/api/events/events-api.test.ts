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
  membership?: { household_id: string } | null;
  events?: unknown[];
  insertId?: string;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
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
      order() {
        return query;
      },
      insert() {
        return query;
      },
      update() {
        return query;
      },
      delete() {
        return query;
      },
      async maybeSingle() {
        if (table === "household_members") {
          return { data: options.membership ?? null, error: null };
        }
        return { data: null, error: null };
      },
      async single() {
        if (options.insertId) {
          return { data: { id: options.insertId }, error: null };
        }
        return { data: null, error: { message: "missing" } };
      },
      then(
        resolve: (value: { data: unknown; error: { message: string } | null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        let error: { message: string } | null = null;
        if (table === "events") data = options.events ?? [];
        if (table === "events" && options.updateError) error = options.updateError;
        if (table === "events" && options.deleteError) error = options.deleteError;
        return Promise.resolve({ data, error }).then(resolve, reject);
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

const privateEvent = {
  title: "رویداد خصوصی",
  visibility: "PRIVATE",
  startAt: "2026-08-28T18:00:00.000Z",
  endAt: "2026-08-28T20:00:00.000Z",
  allDay: false,
};

describe("events API auth", () => {
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
          await POST(jsonRequest("http://localhost/api/events", "POST", privateEvent)),
        )
      ).status,
    ).toBe(401);
  });

  it("PATCH unauthenticated → 401", async () => {
    const { PATCH } = await import("./[id]/route");
    expect(
      (
        await read(
          await PATCH(jsonRequest("http://localhost/api/events/e1", "PATCH", privateEvent), {
            params: Promise.resolve({ id: "e1" }),
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("DELETE unauthenticated → 401", async () => {
    const { DELETE } = await import("./[id]/route");
    expect(
      (
        await read(
          await DELETE(jsonRequest("http://localhost/api/events/e1", "DELETE"), {
            params: Promise.resolve({ id: "e1" }),
          }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("events API authorization", () => {
  it("returns only events supplied by RLS", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        events: [{ id: "e1", title: "خصوصی", visibility: "PRIVATE", owner_id: userA.id }],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.events).toHaveLength(1);
  });

  it("does not leak another household's events when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h2" },
        events: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.events).toEqual([]);
  });

  it("creates a private event", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, insertId: "e-new" }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(jsonRequest("http://localhost/api/events", "POST", privateEvent)),
    );
    expect(result.status).toBe(200);
    expect(result.body.id).toBe("e-new");
  });

  it("rejects a shared event without a household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/events", "POST", {
          ...privateEvent,
          visibility: "HOUSEHOLD_SHARED",
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });
});
