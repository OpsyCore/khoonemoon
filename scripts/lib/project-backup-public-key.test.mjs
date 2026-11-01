import { describe, expect, it } from "vitest";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encryptForProjectOwner,
  decryptForProjectOwner,
} from "./project-backup-public-key.mjs";

const pair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
describe("project archive public-key envelope", () => {
  it("streams data larger than the mobile limit and requires the correct private key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "project-key-"));
    try {
      const a = pair(),
        b = pair(),
        src = join(dir, "source"),
        enc = join(dir, "encrypted"),
        out = join(dir, "out");
      const bytes = randomBytes(17 * 1024 * 1024);
      await writeFile(src, bytes);
      await encryptForProjectOwner(src, enc, a.publicKey);
      await expect(
        decryptForProjectOwner(enc, out, b.privateKey),
      ).rejects.toThrow();
      expect((await readdir(dir)).some((x) => x.startsWith("out"))).toBe(false);
      await decryptForProjectOwner(enc, out, a.privateKey);
      expect((await readFile(out)).equals(bytes)).toBe(true);
      await expect(
        decryptForProjectOwner(enc, out, a.privateKey),
      ).rejects.toThrow();
      expect((await readFile(out)).equals(bytes)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
  it("rejects tampering, truncation, and short RSA keys without publishing plaintext", async () => {
    const dir = await mkdtemp(join(tmpdir(), "project-key-"));
    try {
      const a = pair(),
        short = generateKeyPairSync("rsa", {
          modulusLength: 2048,
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });
      const src = join(dir, "source"),
        enc = join(dir, "encrypted"),
        out = join(dir, "out");
      await writeFile(src, "");
      await expect(
        encryptForProjectOwner(src, enc, short.publicKey),
      ).rejects.toThrow();
      await encryptForProjectOwner(src, enc, a.publicKey);
      const data = await readFile(enc);
      data[data.length - 1] ^= 1;
      await writeFile(enc, data);
      await expect(
        decryptForProjectOwner(enc, out, a.privateKey),
      ).rejects.toThrow();
      await writeFile(enc, data.subarray(0, 3));
      await expect(
        decryptForProjectOwner(enc, out, a.privateKey),
      ).rejects.toThrow();
      expect((await readdir(dir)).some((x) => x.startsWith("out"))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
