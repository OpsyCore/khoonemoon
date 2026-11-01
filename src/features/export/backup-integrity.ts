/** Read only our bounded, uncompressed ZIP format. Never extract to disk or DB. */
const MAX_ZIP = 16 * 1024 * 1024;
const MAX_JSON = 4 * 1024 * 1024;
const MAX_DOCUMENTS = 12 * 1024 * 1024;
const documentName =
  /^documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/i;
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const invalid = () =>
  new Error("ساختار فایل خروجی معتبر نیست یا از حد مجاز بیشتر است.");
function readName(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalid();
  }
}
function parseStoredZip(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length < 22 || bytes.length > MAX_ZIP) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (pos: number) => {
    if (pos < 0 || pos + 2 > bytes.length) throw invalid();
    return view.getUint16(pos, true);
  };
  const u32 = (pos: number) => {
    if (pos < 0 || pos + 4 > bytes.length) throw invalid();
    return view.getUint32(pos, true);
  };
  const eocd = bytes.length - 22;
  if (
    u32(eocd) !== 0x06054b50 ||
    u16(eocd + 4) !== 0 ||
    u16(eocd + 6) !== 0 ||
    u16(eocd + 20) !== 0
  )
    throw invalid();
  const count = u16(eocd + 10),
    centralSize = u32(eocd + 12),
    centralOffset = u32(eocd + 16);
  if (
    count !== u16(eocd + 8) ||
    count < 1 ||
    count > 202 ||
    centralOffset + centralSize !== eocd
  )
    throw invalid();
  const result: Record<string, Uint8Array> = Object.create(null);
  const spans: { start: number; end: number }[] = [];
  let pos = centralOffset,
    totalDocuments = 0;
  for (let i = 0; i < count; i++) {
    if (u32(pos) !== 0x02014b50 || pos + 46 > eocd) throw invalid();
    const flags = u16(pos + 8),
      method = u16(pos + 10),
      compressed = u32(pos + 20),
      size = u32(pos + 24),
      n = u16(pos + 28),
      x = u16(pos + 30),
      comment = u16(pos + 32),
      disk = u16(pos + 34),
      local = u32(pos + 42);
    if (
      (flags & ~0x0800) !== 0 ||
      method !== 0 ||
      compressed !== size ||
      disk !== 0 ||
      pos + 46 + n + x + comment > eocd
    )
      throw invalid();
    const name = readName(bytes.subarray(pos + 46, pos + 46 + n));
    if (
      name !== "archive.json" &&
      name !== "checksums.json" &&
      !documentName.test(name)
    )
      throw invalid();
    if (
      Object.hasOwn(result, name) ||
      u32(local) !== 0x04034b50 ||
      local + 30 > centralOffset
    )
      throw invalid();
    const ln = u16(local + 26),
      lx = u16(local + 28),
      dataStart = local + 30 + ln + lx,
      dataEnd = dataStart + size;
    if (
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u32(local + 18) !== size ||
      u32(local + 22) !== size ||
      readName(bytes.subarray(local + 30, local + 30 + ln)) !== name ||
      dataEnd > centralOffset
    )
      throw invalid();
    if (
      (name === "archive.json" && size > MAX_JSON) ||
      (name === "checksums.json" && size > 65536)
    )
      throw invalid();
    if (documentName.test(name)) {
      totalDocuments += size;
      if (totalDocuments > MAX_DOCUMENTS) throw invalid();
    }
    if (
      u32(local + 14) !== u32(pos + 16) ||
      crc32(bytes.subarray(dataStart, dataEnd)) !== u32(pos + 16)
    )
      throw invalid();
    spans.push({ start: local, end: dataEnd });
    result[name] = bytes.subarray(dataStart, dataEnd);
    pos += 46 + n + x + comment;
  }
  if (pos !== eocd) throw invalid();
  spans.sort((a, b) => a.start - b.start);
  let expected = 0;
  for (const span of spans) {
    if (span.start !== expected || span.end < span.start) throw invalid();
    expected = span.end;
  }
  if (expected !== centralOffset || !result["archive.json"]) throw invalid();
  return result;
}
export async function digestBytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error("بررسی یکپارچگی در این دستگاه پشتیبانی نمی‌شود.");
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function buildChecksums(
  files: Record<string, Uint8Array>,
): Promise<Uint8Array> {
  const checksums: Record<string, string> = Object.create(null);
  for (const name of Object.keys(files).sort())
    checksums[name] = await digestBytes(files[name]);
  return new TextEncoder().encode(
    JSON.stringify({ version: 1, algorithm: "SHA-256", files: checksums }),
  );
}
export type BackupPreview = {
  exportedAt: string;
  tableCount: number;
  rowCount: number;
  documents: number;
  integrity: "verified" | "legacy";
};
/** A valid checksum detects accidental corruption, not malicious replacement. */
export async function inspectBackup(bytes: Uint8Array): Promise<BackupPreview> {
  const files = parseStoredZip(bytes);
  let archive: { exported_at?: unknown; tables?: unknown; counts?: unknown };
  try {
    archive = JSON.parse(readName(files["archive.json"]));
  } catch {
    throw invalid();
  }
  if (
    !archive ||
    typeof archive !== "object" ||
    typeof archive.exported_at !== "string" ||
    !Number.isFinite(Date.parse(archive.exported_at)) ||
    !archive.tables ||
    typeof archive.tables !== "object" ||
    Array.isArray(archive.tables) ||
    !archive.counts ||
    typeof archive.counts !== "object" ||
    Array.isArray(archive.counts)
  )
    throw invalid();
  const tables = archive.tables as Record<string, unknown>;
  const counts = archive.counts as Record<string, unknown>;
  const names = Object.keys(tables);
  if (
    names.length < 1 ||
    names.length > 50 ||
    names.some((n) => !/^[a-z][a-z0-9_]{0,63}$/.test(n)) ||
    Object.keys(counts).length !== names.length
  )
    throw invalid();
  let rowCount = 0;
  for (const name of names) {
    const rows = tables[name];
    if (
      !Array.isArray(rows) ||
      rows.length > 10000 ||
      counts[name] !== rows.length
    )
      throw invalid();
    rowCount += rows.length;
  }
  if (!Array.isArray(tables.documents) || tables.documents.length > 200)
    throw invalid();
  const references = new Set<string>();
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  for (const row of tables.documents) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      typeof row.mime_type !== "string" ||
      !Object.hasOwn(extensions, row.mime_type) ||
      typeof row.archive_file !== "string" ||
      row.archive_file !== `documents/${row.id}.${extensions[row.mime_type]}` ||
      !documentName.test(row.archive_file) ||
      references.has(row.archive_file) ||
      !files[row.archive_file] ||
      !Number.isSafeInteger(row.file_size) ||
      row.file_size !== files[row.archive_file].length
    )
      throw invalid();
    references.add(row.archive_file);
  }
  const actualFiles = Object.keys(files).filter((name) =>
    documentName.test(name),
  );
  if (
    actualFiles.length !== references.size ||
    actualFiles.some((name) => !references.has(name))
  )
    throw invalid();
  let integrity: BackupPreview["integrity"] = "legacy";
  if (files["checksums.json"]) {
    let manifest: { version?: unknown; algorithm?: unknown; files?: unknown };
    try {
      manifest = JSON.parse(readName(files["checksums.json"]));
    } catch {
      throw invalid();
    }
    if (
      !manifest ||
      manifest.version !== 1 ||
      manifest.algorithm !== "SHA-256" ||
      !manifest.files ||
      typeof manifest.files !== "object" ||
      Array.isArray(manifest.files)
    )
      throw invalid();
    const expected = manifest.files as Record<string, unknown>;
    const all = Object.keys(files).filter((name) => name !== "checksums.json");
    if (Object.keys(expected).length !== all.length) throw invalid();
    for (const name of all)
      if (
        typeof expected[name] !== "string" ||
        !/^[a-f0-9]{64}$/.test(expected[name] as string) ||
        (await digestBytes(files[name])) !== expected[name]
      )
        throw new Error(
          "یکپارچگی فایل تأیید نشد؛ خروجی ممکن است آسیب دیده باشد.",
        );
    integrity = "verified";
  }
  return {
    exportedAt: archive.exported_at,
    tableCount: names.length,
    rowCount,
    documents: references.size,
    integrity,
  };
}
