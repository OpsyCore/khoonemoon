import { describe, expect, it } from "vitest";
import pg from "pg";
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureProjectData } from "./project-backup-capture.mjs";
import { packageProjectCapture } from "./project-backup-package.mjs";
import { decryptForProjectOwner } from "./project-backup-public-key.mjs";

const testUrl = process.env.PROJECT_BACKUP_TEST_DATABASE_URL;
async function run(command, args, env = {}, { input, output } = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: [input ? "pipe" : "ignore", output ? "pipe" : "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${code}): ${stderr}`)),
    );
  });
  const streams = [];
  if (input) streams.push(pipeline(createReadStream(input), child.stdin));
  if (output)
    streams.push(
      pipeline(
        child.stdout,
        createWriteStream(output, { flags: "wx", mode: 0o600 }),
      ),
    );
  await Promise.all([exited, ...streams]);
}

describe.skipIf(!testUrl)("PostgreSQL snapshot capture drill", () => {
  it("restores sample auth rows and captured object bytes after concurrent insert", async () => {
    const url = new URL(testUrl);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/khoonemoon_backup_test"
    )
      throw new Error("Drill only accepts the isolated local test database.");
    const connectionString = testUrl;
    const snapshotClient = new pg.Client({ connectionString });
    const liveClient = new pg.Client({ connectionString });
    const dir = await mkdtemp(join(tmpdir(), "project-drill-"));
    const restoreName = `backup_drill_${randomBytes(8).toString("hex")}`;
    const env = {
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.slice(1),
    };
    let restoredClient;
    try {
      await snapshotClient.connect();
      await liveClient.connect();
      await liveClient.query(`create schema auth; create schema storage;
        create table auth.users(id uuid primary key, encrypted_password text not null);
        create table storage.objects(id uuid primary key,bucket_id text not null,name text not null,version text,updated_at timestamptz,metadata jsonb,unique(bucket_id,name));
        insert into auth.users values ('11111111-1111-4111-8111-111111111111','fixture-password-hash');
        insert into storage.objects values ('22222222-2222-4222-8222-222222222222','documents','x/file.bin','version-1',now(),'{"size":3}');`);
      const directory = join(dir, "capture");
      await captureProjectData({
        snapshotClient,
        liveClient,
        directory,
        storageOrigin: "https://fixture.supabase.co",
        dump: async (snapshot, path) =>
          run(
            "pg_dump",
            [
              "--format=custom",
              "--schema=auth",
              "--schema=storage",
              `--snapshot=${snapshot}`,
            ],
            env,
            { output: path },
          ),
        fetchObject: async () => {
          await liveClient.query(
            "insert into auth.users values ('33333333-3333-4333-8333-333333333333','later')",
          );
          return new Response("abc");
        },
      });
      const pair = generateKeyPairSync("rsa", {
        modulusLength: 3072,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const encrypted = join(dir, "project.encrypted"),
        tar = join(dir, "project.tar"),
        unpack = join(dir, "unpack");
      await packageProjectCapture(directory, encrypted, pair.publicKey);
      await decryptForProjectOwner(encrypted, tar, pair.privateKey);
      await mkdir(unpack);
      await run("tar", ["-C", unpack, "-xf", tar]);
      await liveClient.query(`create database "${restoreName}"`);
      await run(
        "pg_restore",
        [
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
          `--dbname=${restoreName}`,
        ],
        env,
        { input: join(unpack, "database.dump") },
      );
      const restoredUrl = new URL(testUrl);
      restoredUrl.pathname = `/${restoreName}`;
      restoredClient = new pg.Client({
        connectionString: restoredUrl.toString(),
      });
      await restoredClient.connect();
      const users = await restoredClient.query(
        "select id::text,encrypted_password from auth.users",
      );
      expect(users.rows).toEqual([
        {
          id: "11111111-1111-4111-8111-111111111111",
          encrypted_password: "fixture-password-hash",
        },
      ]);
      const manifest = JSON.parse(
        (await readFile(join(unpack, "objects.jsonl"), "utf8")).trim(),
      );
      expect(
        await readFile(join(unpack, "objects", manifest.file), "utf8"),
      ).toBe("abc");
      expect(
        (
          await restoredClient.query(
            "select count(*)::int as n from storage.objects",
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await restoredClient?.end().catch(() => {});
      await snapshotClient.end().catch(() => {});
      await liveClient.end().catch(() => {});
      await rm(dir, { recursive: true, force: true });
    }
  }, 120000);
});
