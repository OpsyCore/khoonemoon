import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const userA = { id: "11111111-1111-4111-8111-111111111111" };
const taskId = "11111111-1111-4111-8111-111111111111";

type MockOptions = {
  user?: { id: string } | null;
  reminders?: unknown[];
  target?: { id: string; household_id: string | null } | null;
  reminder?: Record<string, unknown> | null;
  insertRows?: unknown[];
  insertError?: { message: string } | null;
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
        if (table === "tasks" || table === "events") {
          return {
            data: options.target ? { id: options.target.id } : null,
            error: null,
          };
        }
        return { data: options.reminder ?? null, error: null };
      },
      async single() {
        if (table === "tasks" || table === "events") {
          if (!options.target)
            return { data: null, error: { message: "missing" } };
          return { data: options.target, error: null };
        }
        if (!options.reminder)
          return { data: null, error: { message: "missing" } };
        return { data: options.reminder, error: null };
      },
      then(
        resolve: (value: {
          data: unknown;
          error: { message: string } | null;
        }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        if (table === "reminders" && options.insertError) {
          return Promise.resolve({
            data: null,
            error: options.insertError,
          }).then(resolve, reject);
        }
        const data =
          table === "reminders"
            ? (options.insertRows ?? options.reminders ?? [])
            : [];
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

describe("reminders API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("GET unauthenticated → 401", async () => {
    const { GET } = await import("./route");
    expect(
      (
        await read(
          await GET(jsonRequest("http://localhost/api/reminders", "GET")),
        )
      ).status,
    ).toBe(401);
  });

  it("POST unauthenticated → 401", async () => {
    const { POST } = await import("./route");
    expect(
      (
        await read(
          await POST(
            jsonRequest("http://localhost/api/reminders", "POST", {
              targetType: "TASK",
              targetId: taskId,
              baseDateTime: "2026-08-28T10:00:00.000Z",
              offsets: [{ minutesBefore: 30 }],
            }),
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("PATCH unauthenticated → 401", async () => {
    const { PATCH } = await import("./[id]/route");
    expect(
      (
        await read(
          await PATCH(
            jsonRequest("http://localhost/api/reminders/r1", "PATCH", {
              action: "cancel",
            }),
            { params: Promise.resolve({ id: "r1" }) },
          ),
        )
      ).status,
    ).toBe(401);
  });
});

describe("reminders API authorization", () => {
  it("returns only the caller's reminders", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        reminders: [
          {
            id: "r1",
            target_type: "TASK",
            target_id: taskId,
            user_id: userA.id,
            household_id: null,
            remind_at: "2026-08-28T12:00:00.000Z",
            status: "PENDING",
            snoozed_until: null,
            snooze_count: 0,
            delivered_at: null,
            created_at: "2026-08-28T10:00:00.000Z",
            updated_at: "2026-08-28T10:00:00.000Z",
          },
        ],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(
      await GET(jsonRequest("http://localhost/api/reminders", "GET")),
    );
    expect(result.status).toBe(200);
    expect(result.body.reminders).toHaveLength(1);
  });

  it("rejects creating a reminder for an inaccessible task", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        target: null,
      }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/reminders", "POST", {
          targetType: "TASK",
          targetId: taskId,
          baseDateTime: "2026-08-28T10:00:00.000Z",
          offsets: [{ minutesBefore: 30 }],
        }),
      ),
    );
    expect(result.status).toBe(403);
  });

  it("returns 404 when snoozing a reminder the user does not own", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        reminder: null,
      }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest(`http://localhost/api/reminders/${taskId}`, "PATCH", {
          action: "snooze",
          minutes: 10,
        }),
        { params: Promise.resolve({ id: taskId }) },
      ),
    );
    expect(result.status).toBe(404);
  });
});
