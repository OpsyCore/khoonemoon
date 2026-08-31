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
  tasks?: unknown[];
  task?: { id: string; status?: string } | null;
  insertTaskId?: string;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
};

function createMockSupabase(options: MockOptions) {
  const membership = options.membership ?? null;
  const memberIds = options.memberIds ?? [];
  const tasks = options.tasks ?? [];
  const task = options.task ?? null;

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
      upsert() {
        return query;
      },
      async maybeSingle() {
        if (table === "household_members") {
          return { data: membership, error: null };
        }
        return { data: task, error: null };
      },
      async single() {
        if (table === "tasks") {
          if (options.insertError) {
            return { data: null, error: options.insertError };
          }
          if (task) return { data: task, error: null };
          return {
            data: options.insertTaskId ? { id: options.insertTaskId } : null,
            error: options.insertTaskId ? null : { message: "missing" },
          };
        }
        return { data: task, error: null };
      },
      then(
        resolve: (value: {
          data: unknown;
          error: { message: string } | null;
        }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        let error: { message: string } | null = null;
        if (table === "tasks") data = tasks;
        if (table === "household_members") {
          data = memberIds.map((user_id) => ({ user_id, profiles: null }));
        }
        if (table === "task_assignees" && options.insertError) {
          error = options.insertError;
        }
        if (table === "tasks" && options.updateError)
          error = options.updateError;
        if (table === "tasks" && options.deleteError)
          error = options.deleteError;
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
  return {
    status: response.status,
    body: await response.json(),
  };
}

const privateTaskPayload = {
  title: "تسک خصوصی",
  visibility: "PRIVATE",
  priority: "NORMAL",
  status: "PENDING",
  assigneeIds: [userA.id],
  recurrence: { frequency: "NONE" },
};

describe("tasks API auth", () => {
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
            jsonRequest(
              "http://localhost/api/tasks",
              "POST",
              privateTaskPayload,
            ),
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
            jsonRequest("http://localhost/api/tasks/t1", "PATCH", {
              action: "complete",
            }),
            { params: Promise.resolve({ id: "t1" }) },
          ),
        )
      ).status,
    ).toBe(401);
  });

  it("DELETE unauthenticated → 401", async () => {
    const { DELETE } = await import("./[id]/route");
    expect(
      (
        await read(
          await DELETE(jsonRequest("http://localhost/api/tasks/t1", "DELETE"), {
            params: Promise.resolve({ id: "t1" }),
          }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("tasks API authorization", () => {
  it("returns only the tasks supplied by RLS for the current user", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: null,
        tasks: [
          {
            id: "t-private",
            title: "خصوصی",
            visibility: "PRIVATE",
            owner_id: userA.id,
          },
        ],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.tasks).toHaveLength(1);
    expect(result.body.householdId).toBeNull();
  });

  it("does not return another household's tasks when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h2" },
        memberIds: [userB.id],
        tasks: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.tasks).toEqual([]);
  });

  it("creates a private task for the authenticated user", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: null,
        insertTaskId: "t-new",
      }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/tasks", "POST", privateTaskPayload),
      ),
    );
    expect(result.status).toBe(200);
    expect(result.body.id).toBe("t-new");
  });

  it("rejects a shared task when the user has no household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        membership: null,
      }),
    );
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/tasks", "POST", {
          ...privateTaskPayload,
          visibility: "HOUSEHOLD_SHARED",
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });

  it("returns 404 when patching a task RLS does not expose", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        task: null,
      }),
    );
    const { PATCH } = await import("./[id]/route");
    const result = await read(
      await PATCH(
        jsonRequest("http://localhost/api/tasks/t1", "PATCH", {
          action: "complete",
        }),
        { params: Promise.resolve({ id: "t1" }) },
      ),
    );
    expect(result.status).toBe(404);
  });

  it("rejects invalid create payloads", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const result = await read(
      await POST(
        jsonRequest("http://localhost/api/tasks", "POST", {
          title: "ا",
          visibility: "PRIVATE",
        }),
      ),
    );
    expect(result.status).toBe(400);
  });
});
