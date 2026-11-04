/**
 * Operator-only backup capture primitive. Not connected to production or UI.
 *
 * A consistent database snapshot is dumped first, together with the snapshot's
 * Storage object inventory. After the snapshot is closed each object must still
 * match that inventory before and after download, or the entire capture fails.
 * Authentication, permission to export every account, a safe destination and
 * actual Supabase restore procedures are the caller's responsibility.
 *
 * The work directory contains plaintext, including authentication data. Use
 * private, encrypted ephemeral storage; crash cleanup and secure erasure are
 * not guaranteed. Never publish this directory or its logs.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const BATCH_SIZE = 500;
const BASE = /^[a-z0-9][a-z0-9.-]*$/;

/** Construct an API path without allowing path normalization or redirects. */
export function storageObjectUrl(base, bucket, name) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !BASE.test(url.hostname)
  )
    throw new Error("Invalid storage origin.");
  if (
    typeof bucket !== "string" ||
    !bucket ||
    typeof name !== "string" ||
    !name
  )
    throw new Error("Invalid storage object path.");
  const segments = [bucket, ...name.split("/")];
  if (
    segments.some((s) => !s || s === "." || s === ".." || s.includes("\u0000"))
  )
    throw new Error("Unsupported storage object path.");
  return `${url.origin}/storage/v1/object/${segments.map(encodeURIComponent).join("/")}`;
}

function sameObject(current, expected) {
  return (
    !!current &&
    current.id === expected.id &&
    current.bucket_id === expected.bucket_id &&
    current.name === expected.name &&
    current.version === expected.version &&
    current.updated_at === expected.updated_at &&
    JSON.stringify(current.metadata) === JSON.stringify(expected.metadata)
  );
}

async function inventory(client, file) {
  const out = await open(file, "wx", 0o600);
  let bucket = "",
    name = "",
    count = 0;
  try {
    while (true) {
      const { rows } = await client.query(
        `select id::text, bucket_id, name, version, updated_at::text, metadata
        from storage.objects
        where (bucket_id collate "C", name collate "C") > ($1::text collate "C", $2::text collate "C")
        order by bucket_id collate "C", name collate "C" limit $3`,
        [bucket, name, BATCH_SIZE],
      );
      if (!rows.length) break;
      for (const row of rows) {
        if (!row.id || !row.version || !row.updated_at)
          throw new Error("Storage inventory cannot be verified safely.");
        await out.writeFile(JSON.stringify(row) + "\n");
        count++;
      }
      ({ bucket_id: bucket, name } = rows.at(-1));
    }
    await out.sync();
    return count;
  } finally {
    await out.close();
  }
}

async function getCurrent(client, row) {
  const result = await client.query(
    "select id::text, bucket_id, name, version, updated_at::text, metadata from storage.objects where id = $1",
    [row.id],
  );
  return result.rows[0];
}

/** Caller supplies connected source clients, dump function and HTTP client. */
export async function captureProjectData({
  snapshotClient,
  liveClient,
  dump,
  fetchObject,
  directory,
  storageOrigin,
}) {
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await chmod(directory, 0o700);
  const objectsDir = join(directory, "objects");
  const inventoryPath = join(directory, "inventory.jsonl");
  await mkdir(objectsDir, { mode: 0o700 });
  let transactionOpen = false;
  try {
    await snapshotClient.query(
      "begin isolation level repeatable read read only",
    );
    transactionOpen = true;
    const snapshot = (
      await snapshotClient.query("select pg_export_snapshot() as snapshot")
    ).rows[0]?.snapshot;
    if (typeof snapshot !== "string" || !/^[0-9A-Fa-f-]+$/.test(snapshot))
      throw new Error("Could not export a database snapshot.");
    const count = await inventory(snapshotClient, inventoryPath);
    await dump(snapshot, join(directory, "database.dump"));
    await snapshotClient.query("commit");
    transactionOpen = false;

    // The inventory can be arbitrarily large; stream it instead of parsing it all at once.
    const { createReadStream } = await import("node:fs");
    const { createInterface } = await import("node:readline");
    const lines = createInterface({
      input: createReadStream(inventoryPath),
      crlfDelay: Infinity,
    });
    const manifest = await open(join(directory, "objects.jsonl"), "wx", 0o600);
    let downloaded = 0;
    try {
      for await (const line of lines) {
        const row = JSON.parse(line);
        if (!sameObject(await getCurrent(liveClient, row), row))
          throw new Error(
            "Storage changed during backup; no backup was published.",
          );
        const path = storageObjectUrl(storageOrigin, row.bucket_id, row.name);
        const response = await fetchObject(path);
        if (!response.ok || response.redirected || !response.body)
          throw new Error("Storage download failed; no backup was published.");
        const filename = createHash("sha256")
          .update(JSON.stringify([row.bucket_id, row.name]))
          .digest("hex");
        const hash = createHash("sha256");
        let size = 0;
        const counter = new Transform({
          transform(chunk, _enc, cb) {
            size += chunk.length;
            hash.update(chunk);
            cb(null, chunk);
          },
        });
        await pipeline(
          Readable.fromWeb(response.body),
          counter,
          createWriteStream(join(objectsDir, filename), {
            flags: "wx",
            mode: 0o600,
          }),
        );
        if (!sameObject(await getCurrent(liveClient, row), row))
          throw new Error(
            "Storage changed during backup; no backup was published.",
          );
        const expectedSize = row.metadata?.size;
        if (
          expectedSize != null &&
          (!Number.isSafeInteger(expectedSize) || expectedSize !== size)
        )
          throw new Error("Storage file length did not match its metadata.");
        await manifest.writeFile(
          JSON.stringify({
            id: row.id,
            bucket: row.bucket_id,
            name: row.name,
            version: row.version,
            file: filename,
            size,
            sha256: hash.digest("hex"),
          }) + "\n",
        );
        downloaded++;
      }
      await manifest.sync();
    } finally {
      lines.close();
      await manifest.close();
    }
    if (downloaded !== count)
      throw new Error("Storage inventory is incomplete.");
    await writeFile(
      join(directory, "capture.json"),
      JSON.stringify({
        format: 1,
        storage_objects: count,
        database: "database.dump",
        created_at: new Date().toISOString(),
        limitations: [
          "raw PostgreSQL dump; managed Supabase restore requires a separately tested procedure",
          "storage and configuration require separate restoration",
          "database global roles and passwords are not included",
        ],
      }),
      { mode: 0o600, flag: "wx" },
    );
    // Inventory contains potentially sensitive metadata but is needed for verification.
    return { objectCount: count };
  } catch (error) {
    if (transactionOpen) await snapshotClient.query("rollback").catch(() => {});
    await rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
