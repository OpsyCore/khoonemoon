/** Automated drill against an isolated local Supabase stack, never production. */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { captureProjectData } from "./project-backup-capture.mjs";
import { packageProjectCapture } from "./project-backup-package.mjs";
import { decryptForProjectOwner } from "./project-backup-public-key.mjs";

const dbUrl = process.env.BACKUP_LOCAL_SUPABASE_DB_URL;
async function run(command, args, env = {}, { input, output } = {}) {
  const p = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: [input ? "pipe" : "ignore", output ? "pipe" : "ignore", "pipe"],
  });
  let stderr = "";
  p.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  const ended = new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${code}): ${stderr}`)),
    );
  });
  const tasks = [ended];
  if (input) tasks.push(pipeline(createReadStream(input), p.stdin));
  if (output)
    tasks.push(
      pipeline(
        p.stdout,
        createWriteStream(output, { flags: "wx", mode: 0o600 }),
      ),
    );
  await Promise.all(tasks);
}

describe.skipIf(!dbUrl)("local Supabase account and file backup drill", () => {
  it("restores a deleted fixture account and uploaded fixture object", async () => {
    const db = new URL(dbUrl);
    const api = new URL(process.env.BACKUP_LOCAL_SUPABASE_API_URL);
    if (
      !["localhost", "127.0.0.1"].includes(db.hostname) ||
      db.port !== "54322" ||
      db.pathname !== "/postgres" ||
      !["localhost", "127.0.0.1"].includes(api.hostname) ||
      api.port !== "54321" ||
      api.protocol !== "http:"
    )
      throw new Error(
        "This drill only permits an isolated local Supabase stack.",
      );
    const serviceKey = process.env.BACKUP_LOCAL_SUPABASE_SERVICE_KEY,
      anonKey = process.env.BACKUP_LOCAL_SUPABASE_ANON_KEY;
    if (!serviceKey || !anonKey)
      throw new Error("Missing fixture credentials.");
    const admin = createClient(api.origin, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymous = createClient(api.origin, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const snapshotClient = new pg.Client({ connectionString: dbUrl }),
      liveClient = new pg.Client({ connectionString: dbUrl });
    const dir = await mkdtemp(join(tmpdir(), "supa-backup-fixture-"));
    const email = `fixture-${randomBytes(6).toString("hex")}@example.test`,
      password = `Fixture-${randomBytes(16).toString("hex")}`;
    const env = {
      PGHOST: db.hostname,
      PGPORT: db.port,
      PGUSER: decodeURIComponent(db.username),
      PGPASSWORD: decodeURIComponent(db.password),
      PGDATABASE: "postgres",
    };
    try {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Fixture account creation failed.");
      const userId = created.data.user.id;
      if (
        (
          await admin.storage.createBucket("fixture-documents", {
            public: false,
          })
        ).error
      )
        throw new Error("Fixture bucket creation failed.");
      if (
        (
          await admin.storage
            .from("fixture-documents")
            .upload("user/document.bin", new Blob(["fixture-object"]))
        ).error
      )
        throw new Error("Fixture upload failed.");
      await snapshotClient.connect();
      await liveClient.connect();
      const capture = join(dir, "capture");
      await captureProjectData({
        snapshotClient,
        liveClient,
        directory: capture,
        storageOrigin: "https://fixture.supabase.co",
        dump: (snapshot, output) =>
          run(
            "pg_dump",
            [
              "--format=custom",
              "--table=auth.users",
              "--table=auth.identities",
              "--table=storage.objects",
              `--snapshot=${snapshot}`,
            ],
            env,
            { output },
          ),
        fetchObject: (url) =>
          fetch(url.replace("https://fixture.supabase.co", api.origin), {
            redirect: "error",
            headers: {
              authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
          }),
      });
      const pair = generateKeyPairSync("rsa", {
        modulusLength: 3072,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const encrypted = join(dir, "backup"),
        tar = join(dir, "backup.tar"),
        unpack = join(dir, "unpack");
      await packageProjectCapture(capture, encrypted, pair.publicKey);
      await decryptForProjectOwner(encrypted, tar, pair.privateKey);
      await mkdir(unpack);
      await run("tar", ["-C", unpack, "-xf", tar]);
      if ((await admin.auth.admin.deleteUser(userId)).error)
        throw new Error("Fixture user deletion failed.");
      if (
        (
          await admin.storage
            .from("fixture-documents")
            .remove(["user/document.bin"])
        ).error
      )
        throw new Error("Fixture file deletion failed.");
      expect(
        (await anonymous.auth.signInWithPassword({ email, password })).error,
      ).toBeTruthy();
      // The managed auth schema already has foreign keys, so restore parents first.
      for (const table of ["users", "identities"]) {
        await run(
          "pg_restore",
          [
            "--data-only",
            "--no-owner",
            "--no-acl",
            "--exit-on-error",
            "--dbname=postgres",
            `--table=${table}`,
          ],
          env,
          { input: join(unpack, "database.dump") },
        );
      }
      const signedIn = await anonymous.auth.signInWithPassword({
        email,
        password,
      });
      expect(signedIn.error).toBeNull();
      expect(signedIn.data.user?.id).toBe(userId);
      const manifest = JSON.parse(
        (await readFile(join(unpack, "objects.jsonl"), "utf8")).trim(),
      );
      const bytes = await readFile(join(unpack, "objects", manifest.file));
      if (
        (
          await admin.storage
            .from(manifest.bucket)
            .upload(manifest.name, bytes, { upsert: false })
        ).error
      )
        throw new Error("Fixture file restore failed.");
      const downloaded = await admin.storage
        .from(manifest.bucket)
        .download(manifest.name);
      expect(downloaded.error).toBeNull();
      expect(await downloaded.data.text()).toBe("fixture-object");
    } finally {
      await snapshotClient.end().catch(() => {});
      await liveClient.end().catch(() => {});
      await rm(dir, { recursive: true, force: true });
    }
  }, 180000);
});
