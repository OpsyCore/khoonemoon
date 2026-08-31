import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const userA = { id: "11111111-1111-4111-8111-111111111111" };

function createMockSupabase({
  user = null,
  profile = null,
}: {
  user?: { id: string } | null;
  profile?: Record<string, unknown> | null;
}) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    upsert() {
      return query;
    },
    async maybeSingle() {
      return { data: profile, error: null };
    },
  };

  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from() {
      return query;
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

describe("profile API", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it("GET unauthenticated → 401", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
    const { GET } = await import("./route");
    expect((await read(await GET())).status).toBe(401);
  });

  it("PATCH unauthenticated → 401", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
    const { PATCH } = await import("./route");
    expect(
      (
        await read(
          await PATCH(
            jsonRequest("http://localhost/api/profile", "PATCH", {
              full_name: "کاربر",
              timezone: "Asia/Tehran",
              locale: "fa-IR",
            }),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("returns the authenticated user's profile", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        profile: {
          id: userA.id,
          full_name: "کاربر",
          timezone: "Asia/Tehran",
          locale: "fa-IR",
        },
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.profile.id).toBe(userA.id);
  });

  it("rejects invalid profile payloads", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { PATCH } = await import("./route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/profile", "PATCH", {
          full_name: "ا",
        }),
      ),
    );
    expect(result.status).toBe(400);
  });
});
