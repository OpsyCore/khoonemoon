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
  const inserted = vi.fn().mockReturnValue({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: failInsert ? null : { id: "ok" },
          error: failInsert ? {} : null,
        }),
    }),
  });
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
    storage: { from: () => ({ upload, remove }) },
    from: (table: string) =>
      table === "documents"
        ? {
            insert: inserted,
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: checkExists ? { id: "ok" } : null,
                    error: checkError ? {} : null,
                  }),
              }),
            }),
          }
        : membership,
  };
  return { api: directDocuments(client as never), upload, remove, inserted };
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
  it("derives shared household membership and cleans up after failed metadata insert", async () => {
    const { api, upload, remove } = setup({ failInsert: true });
    await expect(
      api.create({
        file,
        title: "سند",
        description: "",
        visibility: "HOUSEHOLD_SHARED",
        category: "HOME",
      }),
    ).rejects.toThrow("ناموفق");
    expect(upload.mock.calls[0][0]).toMatch(/^household\/house\//);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
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
    ).rejects.toThrow("نامشخص");
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
  it("does not delete metadata when storage deletion fails", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { message: "denied" } });
    const from = vi.fn();
    const api = directDocuments({
      storage: { from: () => ({ remove }) },
      from,
    } as never);
    await expect(api.remove(row)).rejects.toThrow("مدرک حذف نشد");
    expect(from).not.toHaveBeenCalled();
  });
  it("reports a partial failure if metadata deletion is denied", async () => {
    const api = directDocuments({
      storage: {
        from: () => ({ remove: vi.fn().mockResolvedValue({ error: null }) }),
      },
      from: () => ({
        delete: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as never);
    await expect(api.remove(row)).rejects.toThrow("فایل حذف شد");
  });
});
