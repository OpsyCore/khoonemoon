import { describe, expect, it, vi } from "vitest";
import { directDocuments } from "./direct-client";
function setup({ failInsert = false, auth = true } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const inserted = vi
    .fn()
    .mockReturnValue({
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
      table === "documents" ? { insert: inserted } : membership,
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
