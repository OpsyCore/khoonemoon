import { describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureProjectData,
  storageObjectUrl,
} from "./project-backup-capture.mjs";

const record = {
  id: "11111111-1111-4111-8111-111111111111",
  bucket_id: "documents",
  name: "house/a photo.pdf",
  version: "version-1",
  updated_at: "2026-01-01",
  metadata: { size: 3 },
};
function clients({ changed = false, rows = [record] } = {}) {
  let queries = 0,
    checks = 0;
  return {
    snapshotClient: {
      async query(sql) {
        if (sql.includes("pg_export_snapshot"))
          return { rows: [{ snapshot: "0001-ABCD" }] };
        if (sql.includes("from storage.objects"))
          return { rows: queries++ === 0 ? rows : [] };
        return { rows: [] };
      },
    },
    liveClient: {
      async query() {
        checks++;
        return {
          rows: [
            changed && checks > 1 ? { ...record, version: "changed" } : record,
          ],
        };
      },
    },
  };
}
const dump = async (_snapshot, file) =>
  writeFile(file, "fake database", { mode: 0o600, flag: "wx" });
const fetchObject = async () => new Response("abc", { status: 200 });
const origin = "https://example.supabase.co";

describe("project capture", () => {
  it("records database and storage files from one inventory", async () => {
    const root = await mkdtemp(join(tmpdir(), "capture-"));
    const directory = join(root, "work");
    try {
      expect(
        await captureProjectData({
          ...clients(),
          dump,
          fetchObject,
          directory,
          storageOrigin: origin,
        }),
      ).toEqual({ objectCount: 1 });
      const manifest = JSON.parse(
        (await readFile(join(directory, "objects.jsonl"), "utf8")).trim(),
      );
      expect(manifest.bucket).toBe("documents");
      expect(manifest.size).toBe(3);
      expect(
        await readFile(join(directory, "objects", manifest.file), "utf8"),
      ).toBe("abc");
      expect(manifest.sha256).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
      expect(
        JSON.parse(await readFile(join(directory, "capture.json"), "utf8"))
          .storage_objects,
      ).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("fails closed and removes incomplete capture if the object changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "capture-"));
    const directory = join(root, "work");
    try {
      await expect(
        captureProjectData({
          ...clients({ changed: true }),
          dump,
          fetchObject,
          directory,
          storageOrigin: origin,
        }),
      ).rejects.toThrow("Storage changed");
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects missing versions, truncated data, bad HTTP results and redirects", async () => {
    for (const [options, fetcher] of [
      [{ rows: [{ ...record, version: null }] }, fetchObject],
      [{}, async () => new Response("ab")],
      [{}, async () => new Response("", { status: 403 })],
      [
        {},
        async () => ({
          ok: true,
          redirected: true,
          body: new Response("abc").body,
        }),
      ],
    ]) {
      const root = await mkdtemp(join(tmpdir(), "capture-"));
      try {
        await expect(
          captureProjectData({
            ...clients(options),
            dump,
            fetchObject: fetcher,
            directory: join(root, "work"),
            storageOrigin: origin,
          }),
        ).rejects.toThrow();
        expect(await readdir(root)).toEqual([]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });
  it("prevents path normalization and insecure URLs", () => {
    expect(storageObjectUrl(origin, "documents", "house/a photo.pdf")).toBe(
      `${origin}/storage/v1/object/documents/house/a%20photo.pdf`,
    );
    for (const value of ["../escape", "a/../escape", "a//b", "a/./b"])
      expect(() => storageObjectUrl(origin, "documents", value)).toThrow();
    expect(() =>
      storageObjectUrl("http://example.com", "documents", "a"),
    ).toThrow();
  });
});
