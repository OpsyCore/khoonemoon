import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

const userA = { id: "11111111-1111-4111-8111-111111111111" };
const userB = { id: "22222222-2222-4222-8222-222222222222" };
const docId = "33333333-3333-4333-8333-333333333333";
const entityId = "44444444-4444-4444-8444-444444444444";

type MockOptions = {
  user?: { id: string } | null;
  membership?: { household_id: string } | null;
  documents?: unknown[];
  document?: Record<string, unknown> | null;
  attachments?: unknown[];
  insertId?: string | null;
  insertError?: { message: string } | null;
  entity?: { id: string } | null;
  uploadError?: { message: string } | null;
  signedUrl?: string | null;
  removed?: boolean;
};

function createMockSupabase(options: MockOptions) {
  const uploads: string[] = [];
  const removals: string[] = [];

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
        if (table === "documents") {
          return { data: options.document ?? null, error: null };
        }
        if (
          table === "tasks" ||
          table === "events" ||
          table === "chores" ||
          table === "shopping_lists" ||
          table === "finance_records"
        ) {
          return { data: options.entity ?? null, error: null };
        }
        if (table === "document_attachments") {
          return {
            data: options.insertId ? { id: options.insertId } : null,
            error: options.insertError ?? null,
          };
        }
        return { data: null, error: null };
      },
      async single() {
        if (options.insertError) {
          return { data: null, error: options.insertError };
        }
        if (options.insertId) {
          return { data: { id: options.insertId }, error: null };
        }
        return { data: null, error: { message: "missing" } };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        let data: unknown = [];
        if (table === "documents") data = options.documents ?? [];
        if (table === "document_attachments") data = options.attachments ?? [];
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
    storage: {
      from() {
        return {
          async upload(path: string) {
            uploads.push(path);
            if (options.uploadError) {
              return { data: null, error: options.uploadError };
            }
            return { data: { path }, error: null };
          },
          async createSignedUrl() {
            if (!options.signedUrl) {
              return { data: null, error: { message: "sign failed" } };
            }
            return { data: { signedUrl: options.signedUrl }, error: null };
          },
          async remove(paths: string[]) {
            removals.push(...paths);
            if (options.removed === false) {
              return { data: null, error: { message: "remove failed" } };
            }
            return { data: [], error: null };
          },
        };
      },
    },
    uploads,
    removals,
  };
}

function pdfFile(name = "bill.pdf", size = 12) {
  return new File([new Uint8Array(size).fill(1)], name, {
    type: "application/pdf",
  });
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("documents API auth", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: null }));
  });

  it("GET list unauthenticated → 401", async () => {
    const { GET } = await import("./route");
    expect((await read(await GET())).status).toBe(401);
  });

  it("POST unauthenticated → 401", async () => {
    const { POST } = await import("./route");
    const form = new FormData();
    form.set("title", "قبض");
    form.set("visibility", "PRIVATE");
    form.set("file", pdfFile());
    expect(
      (
        await read(
          await POST(
            new Request("http://localhost/api/documents", {
              method: "POST",
              body: form,
            }),
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
          await GET(new Request("http://localhost/api/documents/x"), {
            params: Promise.resolve({ id: docId }),
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("signed URL unauthenticated → 401", async () => {
    const { GET } = await import("./[id]/url/route");
    expect(
      (
        await read(
          await GET(new Request("http://localhost/api/documents/x/url"), {
            params: Promise.resolve({ id: docId }),
          }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("documents API CRUD and isolation", () => {
  it("returns only documents supplied by RLS", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        documents: [
          {
            id: docId,
            title: "خصوصی",
            visibility: "PRIVATE",
            created_by: userA.id,
          },
        ],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.documents).toHaveLength(1);
  });

  it("does not leak another household's documents when RLS yields none", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userB,
        membership: { household_id: "h2" },
        documents: [],
      }),
    );
    const { GET } = await import("./route");
    const result = await read(await GET());
    expect(result.status).toBe(200);
    expect(result.body.documents).toEqual([]);
  });

  it("creates a PRIVATE document and uploads to the user prefix", async () => {
    const client = createMockSupabase({
      user: userA,
      membership: null,
      insertId: docId,
    });
    mockCreateClient.mockResolvedValue(client);
    const { POST } = await import("./route");
    const form = new FormData();
    form.set("title", "شناسنامه");
    form.set("visibility", "PRIVATE");
    form.set("file", pdfFile());
    const result = await read(
      await POST(
        new Request("http://localhost/api/documents", {
          method: "POST",
          body: form,
        }),
      ),
    );
    expect(result.status).toBe(201);
    expect(client.uploads[0]).toContain(`user/${userA.id}/`);
  });

  it("rejects SHARED upload without a household", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userA, membership: null }),
    );
    const { POST } = await import("./route");
    const form = new FormData();
    form.set("title", "قرارداد");
    form.set("visibility", "HOUSEHOLD_SHARED");
    form.set("file", pdfFile());
    const result = await read(
      await POST(
        new Request("http://localhost/api/documents", {
          method: "POST",
          body: form,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("خانه");
  });

  it("rejects an invalid MIME type", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const form = new FormData();
    form.set("title", "exe");
    form.set("visibility", "PRIVATE");
    form.set(
      "file",
      new File([new Uint8Array(8)], "a.exe", {
        type: "application/x-msdownload",
      }),
    );
    expect(
      (
        await read(
          await POST(
            new Request("http://localhost/api/documents", {
              method: "POST",
              body: form,
            }),
          ),
        )
      ).status,
    ).toBe(400);
  });

  it("rejects a file larger than 10MB", async () => {
    mockCreateClient.mockResolvedValue(createMockSupabase({ user: userA }));
    const { POST } = await import("./route");
    const form = new FormData();
    form.set("title", "بزرگ");
    form.set("visibility", "PRIVATE");
    form.set("file", pdfFile("big.pdf", 10 * 1024 * 1024 + 1));
    expect(
      (
        await read(
          await POST(
            new Request("http://localhost/api/documents", {
              method: "POST",
              body: form,
            }),
          ),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 for an inaccessible document id", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, document: null }),
    );
    const { GET } = await import("./[id]/route");
    const result = await read(
      await GET(new Request("http://localhost/api/documents/x"), {
        params: Promise.resolve({ id: docId }),
      }),
    );
    expect(result.status).toBe(404);
  });

  it("does not issue a signed URL for an inaccessible document", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, document: null, signedUrl: "https://x" }),
    );
    const { GET } = await import("./[id]/url/route");
    const result = await read(
      await GET(new Request("http://localhost/api/documents/x/url"), {
        params: Promise.resolve({ id: docId }),
      }),
    );
    expect(result.status).toBe(404);
  });

  it("issues a signed URL only after metadata access", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        document: {
          id: docId,
          storage_path: `user/${userA.id}/${docId}/bill.pdf`,
        },
        signedUrl: "https://signed.example/bill.pdf",
      }),
    );
    const { GET } = await import("./[id]/url/route");
    const result = await read(
      await GET(new Request("http://localhost/api/documents/x/url"), {
        params: Promise.resolve({ id: docId }),
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body.url).toBe("https://signed.example/bill.pdf");
  });

  it("deletes storage before metadata and forbids cross-user delete", async () => {
    const client = createMockSupabase({
      user: userA,
      document: {
        id: docId,
        storage_path: `user/${userA.id}/${docId}/bill.pdf`,
      },
      insertId: docId,
    });
    mockCreateClient.mockResolvedValue(client);
    const { DELETE } = await import("./[id]/route");
    const result = await read(
      await DELETE(new Request("http://localhost/api/documents/x"), {
        params: Promise.resolve({ id: docId }),
      }),
    );
    expect(result.status).toBe(200);
    expect(client.removals[0]).toContain(`user/${userA.id}/`);

    mockCreateClient.mockResolvedValue(
      createMockSupabase({ user: userB, document: null }),
    );
    const denied = await read(
      await DELETE(new Request("http://localhost/api/documents/x"), {
        params: Promise.resolve({ id: docId }),
      }),
    );
    expect(denied.status).toBe(404);
  });

  it("rejects attaching to an inaccessible entity", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        document: { id: docId, created_by: userA.id, visibility: "PRIVATE" },
        entity: null,
      }),
    );
    const { POST } = await import("./[id]/attachments/route");
    const result = await read(
      await POST(
        new Request("http://localhost/api/documents/x/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "TASK", entityId }),
        }),
        { params: Promise.resolve({ id: docId }) },
      ),
    );
    expect(result.status).toBe(404);
  });

  it("rejects an invalid entity type", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        document: { id: docId },
      }),
    );
    const { POST } = await import("./[id]/attachments/route");
    const result = await read(
      await POST(
        new Request("http://localhost/api/documents/x/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "PROFILE", entityId }),
        }),
        { params: Promise.resolve({ id: docId }) },
      ),
    );
    expect(result.status).toBe(400);
  });

  it("creates an attachment when the entity is visible", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        user: userA,
        document: { id: docId },
        entity: { id: entityId },
        insertId: "att-1",
      }),
    );
    const { POST } = await import("./[id]/attachments/route");
    const result = await read(
      await POST(
        new Request("http://localhost/api/documents/x/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "FINANCE_RECORD", entityId }),
        }),
        { params: Promise.resolve({ id: docId }) },
      ),
    );
    expect(result.status).toBe(201);
  });
});
