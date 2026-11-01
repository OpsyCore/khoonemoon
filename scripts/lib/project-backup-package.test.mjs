import { describe, expect, it } from "vitest";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { packageProjectCapture } from "./project-backup-package.mjs";
import { decryptForProjectOwner } from "./project-backup-public-key.mjs";
const run = promisify(execFile);

describe("project capture packaging", () => {
  it("round-trips an encrypted archive and refuses to overwrite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "capture-package-"));
    try {
      const pair = generateKeyPairSync("rsa", {
        modulusLength: 3072,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const capture = join(dir, "capture"),
        encrypted = join(dir, "encrypted"),
        tar = join(dir, "data.tar"),
        restored = join(dir, "restored");
      await mkdir(capture);
      const fixture = randomBytes(256 * 1024);
      await writeFile(join(capture, "database.dump"), fixture);
      await packageProjectCapture(capture, encrypted, pair.publicKey);
      await expect(
        packageProjectCapture(capture, encrypted, pair.publicKey),
      ).rejects.toThrow();
      expect(
        (await readdir(dir)).filter((x) => x.includes(".staged-")),
      ).toEqual([]);
      await decryptForProjectOwner(encrypted, tar, pair.privateKey);
      await mkdir(restored);
      await run("tar", ["-C", restored, "-xf", tar]);
      expect(
        (await readFile(join(restored, "database.dump"))).equals(fixture),
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
  it("does not publish an archive when tar fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "capture-package-"));
    try {
      const pair = generateKeyPairSync("rsa", {
        modulusLength: 3072,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      await expect(
        packageProjectCapture(
          join(dir, "missing"),
          join(dir, "out"),
          pair.publicKey,
        ),
      ).rejects.toThrow();
      expect(await readdir(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
