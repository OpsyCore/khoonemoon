import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { buildChecksums, inspectBackup } from "./backup-integrity";

const id = "11111111-1111-4111-8111-111111111111";
const name = `documents/${id}.pdf`;
function files() {
  const archive = {
    exported_at: "2026-01-01T00:00:00Z",
    note: "partial",
    tables: {
      tasks: [{ id: "task" }],
      documents: [
        { id, mime_type: "application/pdf", file_size: 4, archive_file: name },
      ],
    },
    counts: { tasks: 1, documents: 1 },
  };
  return {
    "archive.json": strToU8(JSON.stringify(archive)),
    [name]: strToU8("file"),
  };
}
describe("bounded ZIP backup preview", () => {
  it("checks all entries and displays counts, without restoring data", async () => {
    const data: Record<string, Uint8Array> = files();
    data["checksums.json"] = await buildChecksums(data);
    const preview = await inspectBackup(zipSync(data, { level: 0 }));
    expect(preview).toEqual({
      exportedAt: "2026-01-01T00:00:00Z",
      tableCount: 2,
      rowCount: 2,
      documents: 1,
      integrity: "verified",
    });
  });
  it("detects a changed document or manifest", async () => {
    const data: Record<string, Uint8Array> = files();
    data["checksums.json"] = await buildChecksums(data);
    data[name] = strToU8("evil");
    await expect(inspectBackup(zipSync(data, { level: 0 }))).rejects.toThrow(
      "یکپارچگی",
    );
  });
  it("marks old outputs as unverified rather than asserting integrity", async () => {
    expect(
      (await inspectBackup(zipSync(files(), { level: 0 }))).integrity,
    ).toBe("legacy");
  });
  it("rejects unbounded compression, unexpected paths and malformed archives", async () => {
    await expect(
      inspectBackup(zipSync(files(), { level: 9 })),
    ).rejects.toThrow();
    await expect(
      inspectBackup(
        zipSync({ ...files(), "../secret": strToU8("x") }, { level: 0 }),
      ),
    ).rejects.toThrow();
    const bytes = zipSync(files(), { level: 0 });
    await expect(
      inspectBackup(bytes.subarray(0, bytes.length - 2)),
    ).rejects.toThrow();
    await expect(
      inspectBackup(new Uint8Array(16 * 1024 * 1024 + 1)),
    ).rejects.toThrow();
  });
  it("checks the ZIP CRC even in older backups", async () => {
    const zip = zipSync(files(), { level: 0 });
    const marker = new TextEncoder().encode("file");
    let found = -1;
    outer: for (let i = 0; i < zip.length - marker.length; i++) {
      for (let j = 0; j < marker.length; j++)
        if (zip[i + j] !== marker[j]) continue outer;
      found = i;
      break;
    }
    expect(found).toBeGreaterThanOrEqual(0);
    zip[found] ^= 1;
    await expect(inspectBackup(zip)).rejects.toThrow();
  });
  it("rejects missing documents and misleading record counts", async () => {
    const data = files();
    delete (data as Record<string, Uint8Array>)[name];
    await expect(inspectBackup(zipSync(data, { level: 0 }))).rejects.toThrow();
    const bad = files();
    const obj = JSON.parse(new TextDecoder().decode(bad["archive.json"]));
    obj.counts.tasks = 999;
    bad["archive.json"] = strToU8(JSON.stringify(obj));
    await expect(inspectBackup(zipSync(bad, { level: 0 }))).rejects.toThrow();
  });
});
