import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

type TableResult = { data: unknown[]; error?: { message: string } | null };

function createMockSupabase({
  user,
  tables = {},
}: {
  user?: { id: string } | null;
  tables?: Record<string, TableResult>;
}) {
  function tableQuery(table: string) {
    const query = {
      select() {
        return query;
      },
      is() {
        return query;
      },
      eq() {
        return query;
      },
      or() {
        return query;
      },
      limit() {
        return query;
      },
      then(
        resolve: (value: {
          data: unknown;
          error: { message: string } | null;
        }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        const row = tables[table] ?? { data: [] };
        return Promise.resolve({
          data: row.data,
          error: row.error ?? null,
        }).then(resolve, reject);
      },
    };
    return query;
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: user ?? null } }),
    },
    from(table: string) {
      return tableQuery(table);
    },
  };
}

async function read(response: Response) {
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function searchRequest(query: string) {
  return new Request(`http://localhost/api/search?${query}`);
}

describe("search API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("rejects unauthenticated search", async () => {
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=نان")));
    expect(result.status).toBe(401);
  });
});

describe("search API query handling", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: { id: "user-a" } }),
    );
  });

  it("rejects empty query", async () => {
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=")));
    expect(result.status).toBe(400);
  });

  it("rejects whitespace query", async () => {
    const { GET } = await import("./route");
    const result = await read(
      await GET(searchRequest("q=+++".replaceAll("+", "%20"))),
    );
    expect(result.status).toBe(400);
  });

  it("rejects a too-long query", async () => {
    const { GET } = await import("./route");
    const result = await read(
      await GET(searchRequest(`q=${encodeURIComponent("آ".repeat(81))}`)),
    );
    expect(result.status).toBe(400);
  });
});

describe("search API results", () => {
  it("returns authenticated mixed-type results, ranked and de-duplicated", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-a" },
        tables: {
          tasks: {
            data: [
              { id: "t1", title: "نان", description: null },
              { id: "t1", title: "نان", description: "dup" },
            ],
          },
          chores: {
            data: [{ id: "c1", title: "خرید نان", description: null }],
          },
          shopping_lists: {
            data: [{ id: "l1", name: "نانوایی" }],
          },
          shopping_items: {
            data: [{ id: "i1", list_id: "l1", name: "نان سنگک", note: null }],
          },
          events: {
            data: [
              {
                id: "e1",
                title: "مهمانی",
                description: "نان و پنیر",
                location: "خانه",
              },
            ],
          },
          finance_records: {
            data: [{ id: "f1", title: "نان", category: "خوراک", note: null }],
          },
        },
      }),
    );

    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=%D9%86%D8%A7%D9%86")));
    expect(result.status).toBe(200);
    const results = result.body.results as Array<{ id: string; type: string }>;
    expect(result.body.total).toBe(results.length);
    expect(results.filter((item) => item.id === "t1")).toHaveLength(1);
    expect(results.some((item) => item.type === "task")).toBe(true);
    expect(results.some((item) => item.type === "chore")).toBe(true);
    expect(results.some((item) => item.type === "shopping_list")).toBe(true);
    expect(results.some((item) => item.type === "shopping_item")).toBe(true);
    expect(results.some((item) => item.type === "event")).toBe(true);
    expect(results.some((item) => item.type === "finance")).toBe(true);
  });

  it("is case-insensitive", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-a" },
        tables: {
          tasks: { data: [{ id: "t1", title: "Milk", description: null }] },
        },
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=milk")));
    expect(result.status).toBe(200);
    const results = result.body.results as Array<{ title: string }>;
    expect(results[0]?.title).toBe("Milk");
  });

  it("returns an empty list when nothing matches", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-a" },
        tables: {},
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=xyzzy")));
    expect(result.status).toBe(200);
    expect(result.body.results).toEqual([]);
    expect(result.body.total).toBe(0);
  });

  it("does not return another household's rows when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-b" },
        tables: {
          tasks: { data: [] },
          finance_records: { data: [] },
        },
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=%D9%86%D8%A7%D9%86")));
    expect(result.status).toBe(200);
    expect(result.body.results).toEqual([]);
  });

  it("does not leak a private record that RLS omitted", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-b" },
        tables: {
          tasks: {
            data: [{ id: "own", title: "نان من", description: null }],
          },
        },
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=%D9%86%D8%A7%D9%86")));
    const results = result.body.results as Array<{ id: string }>;
    expect(results.map((item) => item.id)).toEqual(["own"]);
  });

  it("queries only finance_records when type=finance", async () => {
    const queried: string[] = [];
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-a" } } }),
      },
      from(table: string) {
        queried.push(table);
        const query = {
          select() {
            return query;
          },
          is() {
            return query;
          },
          eq() {
            return query;
          },
          or() {
            return query;
          },
          limit() {
            return Promise.resolve({
              data:
                table === "finance_records"
                  ? [{ id: "f1", title: "قبض برق", category: null, note: null }]
                  : [],
              error: null,
            });
          },
        };
        return query;
      },
    });
    const { GET } = await import("./route");
    const result = await read(
      await GET(searchRequest("q=%D9%82%D8%A8%D8%B6&type=finance")),
    );
    expect(result.status).toBe(200);
    expect(queried).toEqual(["finance_records"]);
    const results = result.body.results as Array<{
      type: string;
      href: string;
    }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe("finance");
    expect(results[0]?.href).toBe("/finance");
  });

  it("returns 500 when every source query fails", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: { id: "user-a" },
        tables: {
          tasks: { data: [], error: { message: "boom" } },
          chores: { data: [], error: { message: "boom" } },
          shopping_lists: { data: [], error: { message: "boom" } },
          shopping_items: { data: [], error: { message: "boom" } },
          events: { data: [], error: { message: "boom" } },
          finance_records: { data: [], error: { message: "boom" } },
        },
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET(searchRequest("q=نان")));
    expect(result.status).toBe(500);
  });
});
