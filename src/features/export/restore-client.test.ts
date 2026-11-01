import { describe, it, expect, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChecksums } from "./backup-integrity";
import { restoreMissing } from "./restore-client";
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
const user = "00000000-0000-4000-8000-00000000000a",
  doc = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const names =
  "profiles households household_members shopping_lists tasks events chores financial_records reminders notification_preferences task_assignees task_recurrences chore_rotation_steps shopping_items documents document_attachments task_recurrence_instances finance_recurrence_instances chore_completions".split(
    " ",
  );
async function fixture(withDoc = false) {
  const tables: Record<string, Record<string, unknown>[]> = Object.fromEntries(
    names.map((n) => [n, []]),
  );
  tables.profiles = [{ id: user }];
  const files: Record<string, Uint8Array> = {};
  if (withDoc) {
    tables.documents = [
      {
        id: doc,
        household_id: null,
        created_by: user,
        visibility: "PRIVATE",
        mime_type: "application/pdf",
        file_size: 3,
        archive_file: `documents/${doc}.pdf`,
      },
    ];
    files[`documents/${doc}.pdf`] = new Uint8Array([1, 2, 3]);
  }
  files["archive.json"] = strToU8(
    JSON.stringify({
      exported_at: "2026-01-01T00:00:00Z",
      tables,
      counts: Object.fromEntries(names.map((n) => [n, tables[n].length])),
    }),
  );
  files["checksums.json"] = await buildChecksums(files);
  return { bytes: zipSync(files, { level: 0 }), tables };
}
function mock(
  tables: Record<string, Record<string, unknown>[]>,
  opts: {
    uid?: string;
    uploadError?: boolean;
    download?: Uint8Array;
    missingHistory?: boolean;
  } = {},
) {
  const current = structuredClone(tables);
  current.documents = [];
  if (opts.missingHistory) current.profiles = [];
  const rpc = vi.fn(async (name: string, _params?: unknown) =>
    name === "mobile_export_snapshot"
      ? { data: { tables: current }, error: null }
      : { data: { inserted: 1, skipped: 1 }, error: null },
  );
  const upload = vi.fn(async () => ({
    error: opts.uploadError ? { message: "conflict" } : null,
  }));
  const download = vi.fn(async () => ({
    data: opts.download ? new Blob([new Uint8Array(opts.download)]) : null,
    error: opts.download ? null : { message: "missing" },
  }));
  return {
    client: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: opts.uid ?? user } },
          error: null,
        })),
      },
      rpc,
      storage: { from: vi.fn(() => ({ upload, download })) },
    } as unknown as SupabaseClient,
    rpc,
    upload,
    download,
  };
}
describe("bounded same-account recovery", () => {
  it("restores a verified archive with an explicit call and never overwrites files", async () => {
    const f = await fixture(true),
      m = mock(f.tables);
    expect(await restoreMissing(m.client, f.bytes)).toEqual({
      inserted: 1,
      skipped: 1,
      repairedFiles: 0,
      householdCopy: false,
      deferred: 0,
    });
    expect(m.upload).toHaveBeenCalledWith(
      `user/${user}/${doc}/restore.pdf`,
      expect.any(Blob),
      expect.objectContaining({ upsert: false }),
    );
    const payload = m.rpc.mock.calls[1][1] as {
      p_tables: Record<string, Record<string, unknown>[]>;
    };
    expect(payload.p_tables.documents[0].storage_path).toBe(
      `user/${user}/${doc}/restore.pdf`,
    );
  });
  it("reuses matching staged bytes after an uncertain upload, but refuses different bytes", async () => {
    const f = await fixture(true),
      good = mock(f.tables, {
        uploadError: true,
        download: new Uint8Array([1, 2, 3]),
      });
    await restoreMissing(good.client, f.bytes);
    expect(good.rpc).toHaveBeenCalledTimes(2);
    const bad = mock(f.tables, {
      uploadError: true,
      download: new Uint8Array([3, 2, 1]),
    });
    await expect(restoreMissing(bad.client, f.bytes)).rejects.toThrow(
      "فایل موجود تغییر نکرد",
    );
    expect(bad.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects a different account and missing read-only history before any upload", async () => {
    const f = await fixture(true),
      wrong = mock(f.tables, { uid: doc });
    await expect(restoreMissing(wrong.client, f.bytes)).rejects.toThrow(
      "متعلق به حساب",
    );
    expect(wrong.rpc).not.toHaveBeenCalled();
    expect(wrong.upload).not.toHaveBeenCalled();
    const missing = mock(f.tables, { missingHistory: true });
    await expect(restoreMissing(missing.client, f.bytes)).rejects.toThrow(
      "تاریخچه",
    );
    expect(missing.upload).not.toHaveBeenCalled();
  });
  it("does not upload for existing documents and does not update them", async () => {
    const f = await fixture(true),
      m = mock(f.tables, { download: new Uint8Array([1, 2, 3]) });
    f.tables.documents[0].storage_path = `user/${user}/${doc}/original.pdf`;
    m.rpc.mockImplementation(async (name: string, _params?: unknown) =>
      name === "mobile_export_snapshot"
        ? { data: { tables: f.tables }, error: null }
        : { data: { inserted: 0, skipped: 2 }, error: null },
    );
    await restoreMissing(m.client, f.bytes);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("repairs only a missing file with unchanged metadata, without overwriting", async () => {
    const f = await fixture(true);
    const path = `user/${user}/${doc}/original.pdf`;
    const current = structuredClone(f.tables);
    current.documents[0].storage_path = path;
    const m = mock(f.tables);
    m.rpc.mockImplementation(async (name: string) =>
      name === "mobile_export_snapshot"
        ? { data: { tables: current }, error: null }
        : { data: { inserted: 0, skipped: 2 }, error: null },
    );
    expect((await restoreMissing(m.client, f.bytes)).repairedFiles).toBe(1);
    expect(m.upload).toHaveBeenCalledWith(
      path,
      expect.any(Blob),
      expect.objectContaining({ upsert: false }),
    );
    current.documents[0].file_size = 4;
    const invalid = mock(f.tables);
    invalid.rpc.mockImplementation(async (name: string) =>
      name === "mobile_export_snapshot"
        ? { data: { tables: current }, error: null }
        : { data: { inserted: 0, skipped: 2 }, error: null },
    );
    await expect(restoreMissing(invalid.client, f.bytes)).rejects.toThrow(
      "اطلاعاتش تغییر کرده",
    );
    expect(invalid.upload).not.toHaveBeenCalled();
  });
  it("rejects another member's missing row before staging files", async () => {
    const f = await fixture(true);
    const current = structuredClone(f.tables);
    current.documents = [];
    f.tables.tasks.push({ id: doc, creator_id: doc, owner_id: doc });
    const files: Record<string, Uint8Array> = {
      [`documents/${doc}.pdf`]: new Uint8Array([1, 2, 3]),
    };
    files["archive.json"] = strToU8(
      JSON.stringify({
        exported_at: "2026-01-01T00:00:00Z",
        tables: f.tables,
        counts: Object.fromEntries(names.map((n) => [n, f.tables[n].length])),
      }),
    );
    files["checksums.json"] = await buildChecksums(files);
    const m = mock(current);
    await expect(
      restoreMissing(m.client, zipSync(files, { level: 0 })),
    ).rejects.toThrow("عضو دیگری");
    expect(m.upload).not.toHaveBeenCalled();
  });
});
