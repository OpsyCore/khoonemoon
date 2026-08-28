import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const userA = { id: "11111111-1111-4111-8111-111111111111" };
const listId = "11111111-1111-4111-8111-111111111111";

type MockOptions = {
  user?: { id: string } | null;
  membership?: { household_id: string } | null;
  lists?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  list?: { id: string; is_active: boolean } | null;
  inserted?: Record<string, unknown> | null;
  updated?: { id: string } | null;
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
        if (table === "shopping_lists") {
          return { data: options.list ?? null, error: null };
        }
        if (table === "shopping_items") {
          return { data: options.updated ?? null, error: null };
        }
        return { data: null, error: null };
      },
      async single() {
        if (options.inserted) {
          return { data: options.inserted, error: null };
        }
        return { data: null, error: { message: "missing" } };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        if (table === "shopping_lists") data = options.lists ?? [];
        if (table === "shopping_items") data = options.items ?? [];
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

describe("shopping API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("GET lists unauthenticated → 401", async () => {
    const { GET } = await import("@/app/api/shopping/lists/route");
    expect((await read(await GET())).status).toBe(401);
  });

  it("POST list unauthenticated → 401", async () => {
    const { POST } = await import("@/app/api/shopping/lists/route");
    expect(
      (
        await read(
          await POST(
            jsonRequest("http://localhost/api/shopping/lists", "POST", { name: "نانوایی" }),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("POST item unauthenticated → 401", async () => {
    const { POST } = await import("@/app/api/shopping/items/route");
    expect(
      (
        await read(
          await POST(
            jsonRequest("http://localhost/api/shopping/items", "POST", {
              listId,
              name: "نان",
            }),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("PATCH item unauthenticated → 401", async () => {
    const { PATCH } = await import("@/app/api/shopping/items/[id]/route");
    expect(
      (
        await read(
          await PATCH(
            jsonRequest("http://localhost/api/shopping/items/i1", "PATCH", {
              isChecked: true,
            }),
            { params: Promise.resolve({ id: "i1" }) },
          ),
        )
      ).status,
    ).toBe(401);
  });
});

describe("shopping API authorization", () => {
  it("returns empty lists when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, lists: [] }),
    );
    const { GET } = await import("@/app/api/shopping/lists/route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.lists).toEqual([]);
  });

  it("nests items under their lists", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        lists: [
          {
            id: listId,
            household_id: "h1",
            created_by: userA.id,
            name: "نانوایی",
            is_active: true,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
        items: [
          {
            id: "i1",
            list_id: listId,
            created_by: userA.id,
            name: "نان",
            quantity: 1,
            unit: null,
            note: null,
            is_checked: false,
            checked_by: null,
            checked_at: null,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const { GET } = await import("@/app/api/shopping/lists/route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.lists[0].shopping_items).toHaveLength(1);
  });

  it("rejects creating a list without a household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { POST } = await import("@/app/api/shopping/lists/route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/shopping/lists", "POST", { name: "نانوایی" }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });

  it("does not add an item to a list RLS does not expose", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, list: null }),
    );
    const { POST } = await import("@/app/api/shopping/items/route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/shopping/items", "POST", {
          listId,
          name: "نان",
        }),
      ),
    );
    expect(result.status).toBe(404);
  });

  it("creates a list for the caller's household, not a client-supplied household id", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: { household_id: "h1" },
        inserted: {
          id: "list-new",
          name: "نانوایی",
          household_id: "h1",
          is_active: true,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      }),
    );
    const { POST } = await import("@/app/api/shopping/lists/route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/shopping/lists", "POST", {
          name: "نانوایی",
          household_id: "h-forged",
        }),
      ),
    );
    expect(result.status).toBe(201);
    expect(result.body.list.household_id).toBe("h1");
  });
});
