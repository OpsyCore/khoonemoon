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
  membership?: { household_id: string; role: string } | null;
  household?: Record<string, unknown> | null;
  members?: unknown[];
  invitations?: unknown[];
  rpcData?: unknown;
  rpcError?: { message: string } | null;
  updated?: Record<string, unknown> | null;
};

function createMockSupabase(options: MockOptions) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

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
      limit() {
        return query;
      },
      update() {
        return query;
      },
      async maybeSingle() {
        if (table === "household_members") {
          return { data: options.membership ?? null, error: null };
        }
        if (table === "households") {
          return { data: options.updated ?? null, error: null };
        }
        return { data: null, error: null };
      },
      async single() {
        if (table === "households") {
          return { data: options.household ?? null, error: options.household ? null : { message: "missing" } };
        }
        return { data: null, error: { message: "missing" } };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        if (table === "household_members") data = options.members ?? [];
        if (table === "household_invitations") data = options.invitations ?? [];
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
    async rpc(name: string, args: Record<string, unknown> = {}) {
      rpcCalls.push({ name, args });
      if (options.rpcError) return { data: null, error: options.rpcError };
      return { data: options.rpcData ?? true, error: null };
    },
    rpcCalls,
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

describe("household API auth", () => {
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
          await POST(jsonRequest("http://localhost/api/household", "POST", { name: "خانه" })),
        )
      ).status,
    ).toBe(401);
  });

  it("join unauthenticated → 401", async () => {
    const { POST } = await import("./join/route");
    expect(
      (
        await read(
          await POST(
            jsonRequest("http://localhost/api/household/join", "POST", {
              code: "abcdefghijkl",
            }),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("leave unauthenticated → 401", async () => {
    const { POST } = await import("./leave/route");
    expect((await read(await POST())).status).toBe(401);
  });

  it("invite unauthenticated → 401", async () => {
    const { POST } = await import("./invitations/route");
    expect(
      (
        await read(
          await POST(jsonRequest("http://localhost/api/household/invitations", "POST", {})),
        )
      ).status,
    ).toBe(401);
  });
});

describe("household API authorization", () => {
  it("returns an empty household payload when the user has no membership", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.household).toBeNull();
    expect(result.body.members).toEqual([]);
  });

  it("returns the caller's household, not a guessed id", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: { household_id: "h1", role: "OWNER" },
        household: { id: "h1", name: "خانه ما", created_by: userA.id },
        members: [{ user_id: userA.id, role: "OWNER", profiles: null }],
        invitations: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.household.id).toBe("h1");
    expect(result.body.role).toBe("OWNER");
  });

  it("forbids a member from renaming the household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h1", role: "MEMBER" },
      }),
    );
    const { PATCH } = await import("./route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/household", "PATCH", { name: "خانه جدید" }),
      ),
    );
    expect(result.status).toBe(403);
  });

  it("maps invitation reuse to a domain error", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        rpcError: { message: "INVITATION_NOT_PENDING" },
      }),
    );
    const { POST } = await import("./join/route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/household/join", "POST", {
          code: "abcdefghijkl",
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("قابل استفاده نیست");
  });

  it("maps owner-leave-with-members to a domain error", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        rpcError: { message: "OWNER_CANNOT_LEAVE_WITH_ACTIVE_MEMBERS" },
      }),
    );
    const { POST } = await import("./leave/route");
    const result = await read(await POST());
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("مالک");
  });
});
