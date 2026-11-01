import { describe, expect, it, vi } from "vitest";
import { directDocuments } from "./direct-client";
function setup({
  failInsert = false,
  auth = true,
  checkError = false,
  checkExists = false,
} = {}) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const download = vi
    .fn()
    .mockResolvedValue({ data: new Blob(["hello"]), error: null });
  let last:
    { id: string; storage_path: string; created_by: string } | undefined;
  const inserted = vi.fn(
    (row: { id: string; storage_path: string; created_by: string }) => {
      last = row;
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: failInsert ? null : { id: row.id },
              error: failInsert ? {} : null,
            }),
        }),
      };
    },
  );
  const membership = {
    select: () => ({
      eq: () => ({
        is: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { household_id: "house" }, error: null }),
        }),
      }),
    }),
  };
  const client = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          auth
            ? { data: { user: { id: "user" } }, error: null }
            : { data: { user: null }, error: {} },
        ),
    },
    storage: { from: () => ({ upload, remove, download }) },
    from: (table: string) =>
      table === "documents"
        ? {
            insert: inserted,
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: checkExists && last ? last : null,
                    error: checkError ? {} : null,
                  }),
              }),
            }),
          }
        : membership,
  };
  return {
    api: directDocuments(client as never),
    upload,
    remove,
    inserted,
    download,
  };
}
const file = new File(["hello"], "my file.pdf", { type: "application/pdf" });
describe("direct documents", () => {
  it("uses JWT identity and a safe private object path", async () => {
    const { api, upload, inserted } = setup();
    await api.create({
      file,
      title: "سند",
      description: "",
      visibility: "PRIVATE",
      category: "HOME",
    });
    expect(upload.mock.calls[0][0]).toMatch(/^user\/user\/[^/]+\/my_file.pdf$/);
    expect(inserted.mock.calls[0][0]).toMatchObject({
      created_by: "user",
      household_id: null,
      category: "HOME",
    });
  });
  it("derives shared household membership and preserves the object on an uncertain insert", async () => {
    const { api, upload, remove } = setup({ failInsert: true });
    await expect(
      api.create({
        file,
        title: "سند",
        description: "",
        visibility: "HOUSEHOLD_SHARED",
        category: "HOME",
      }),
    ).rejects.toThrow("مشخص نیست");
    expect(upload.mock.calls[0][0]).toMatch(/^household\/house\//);
    expect(remove).not.toHaveBeenCalled();
  });
  it("does not remove a file when insert outcome cannot be verified", async () => {
    const { api, remove } = setup({ failInsert: true, checkError: true });
    await expect(
      api.create({
        file,
        title: "سند",
        description: "",
        visibility: "PRIVATE",
        category: "OTHER",
      }),
    ).rejects.toThrow("مشخص نیست");
    expect(remove).not.toHaveBeenCalled();
  });
  it("keeps the file if the insert committed despite a lost response", async () => {
    const { api, remove } = setup({ failInsert: true, checkExists: true });
    await api.create({
      file,
      title: "سند",
      description: "",
      visibility: "PRIVATE",
      category: "OTHER",
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it("does not upload without authentication or with invalid file types", async () => {
    const { api, upload } = setup({ auth: false });
    await expect(
      api.create({
        file,
        title: "سند",
        description: "",
        visibility: "PRIVATE",
        category: "OTHER",
      }),
    ).rejects.toThrow();
    await expect(
      api.create({
        file: new File(["x"], "x.exe", { type: "application/octet-stream" }),
        title: "سند",
        description: "",
        visibility: "PRIVATE",
        category: "OTHER",
      }),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("document removal safety", () => {
  const row = {
    id: "document-1",
    storage_path: "user/me/document/file.pdf",
  } as never;
  function setupRemoval(
    result: { data: { id: string } | null; error: unknown },
    storageError: unknown = null,
  ) {
    const remove = vi.fn().mockResolvedValue({ error: storageError });
    const dbDelete = vi.fn().mockReturnValue({
      eq: () => ({
        select: () => ({ maybeSingle: () => Promise.resolve(result) }),
      }),
    });
    return {
      remove,
      dbDelete,
      api: directDocuments({
        storage: { from: () => ({ remove }) },
        from: () => ({ delete: dbDelete }),
      } as never),
    };
  }
  it("does not delete the file unless metadata deletion is confirmed", async () => {
    const { api, remove } = setupRemoval({
      data: null,
      error: { message: "network" },
    });
    await expect(api.remove(row)).rejects.toThrow("نامشخص");
    expect(remove).not.toHaveBeenCalled();
  });
  it("deletes the file only after a confirmed metadata deletion", async () => {
    const { api, remove, dbDelete } = setupRemoval({
      data: { id: "document-1" },
      error: null,
    });
    await api.remove(row);
    expect(dbDelete.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(remove).toHaveBeenCalledWith(["user/me/document/file.pdf"]);
  });
  it("reports an orphan risk when storage deletion fails", async () => {
    const { api } = setupRemoval(
      { data: { id: "document-1" }, error: null },
      { message: "network" },
    );
    await expect(api.remove(row)).rejects.toThrow("ممکن است");
  });
});

describe("read-only orphan scan", () => {
  it("requests the RLS protected diagnostic without deleting anything", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ path: "user/me/file", uploaded_at: "2026-01-01T00:00:00Z" }],
      error: null,
    });
    const api = directDocuments({ rpc } as never);
    expect(await api.possibleOrphans()).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("possible_orphan_documents");
    expect(await api.possibleSharedOrphans("house-id")).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("possible_shared_orphan_documents", {
      p_household: "house-id",
    });
    rpc.mockResolvedValueOnce({ data: null, error: {} });
    await expect(api.possibleOrphans()).rejects.toThrow();
  });
});

describe("guarded orphan cleanup", () => {
  it("only removes after the server marks the exact path and confirms absence", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data:
        name === "mark_document_orphan_for_cleanup" ||
        name === "document_cleanup_confirm",
      error: null,
    }));
    const remove = vi.fn().mockResolvedValue({ error: null });
    const api = directDocuments({
      rpc,
      storage: { from: () => ({ remove }) },
    } as never);
    await api.cleanPossibleOrphan("user/me/old/file.pdf");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "mark_document_orphan_for_cleanup",
      "document_cleanup_confirm",
    ]);
    expect(remove).toHaveBeenCalledWith(["user/me/old/file.pdf"]);
  });
  it("never removes when marking fails and never reports an uncertain deletion as successful", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: {} });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const api = directDocuments({
      rpc,
      storage: { from: () => ({ remove }) },
    } as never);
    await expect(
      api.cleanPossibleOrphan("user/me/old/file.pdf"),
    ).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: true, error: null });
    remove.mockResolvedValueOnce({ error: {} });
    await expect(
      api.cleanPossibleOrphan("user/me/old/file.pdf"),
    ).rejects.toThrow("مشخص نیست");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("document retry after lost response", () => {
  it("reuses the file path and validates the existing bytes before finishing metadata", async () => {
    const { api, upload, inserted } = setup({ failInsert: true });
    const input = {
      file,
      title: "retry-document",
      description: "",
      visibility: "PRIVATE" as const,
      category: "HOME",
    };
    await expect(api.create(input)).rejects.toThrow("مشخص نیست");
    const firstPath = upload.mock.calls[0][0];
    upload.mockResolvedValueOnce({ error: { message: "already exists" } });
    inserted.mockImplementationOnce((row) => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: row.id }, error: null }),
      }),
    }));
    await expect(api.create(input)).resolves.toBeUndefined();
    expect(upload.mock.calls[1][0]).toBe(firstPath);
    expect(inserted).toHaveBeenCalledTimes(2);
  });
});
