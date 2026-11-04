import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  encryptProjectBackup,
  decryptProjectBackup,
} from "./project-backup-envelope.mjs";

describe("project-level streaming envelope", () => {
  it("round-trips a file larger than the household backup limit without overwriting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "khoonemoon-envelope-"));
    try {
      const source = join(dir, "source"),
        encrypted = join(dir, "encrypted"),
        restored = join(dir, "restored");
      const original = randomBytes(17 * 1024 * 1024);
      await writeFile(source, original);
      await encryptProjectBackup(source, encrypted, "long passphrase for test");
      await decryptProjectBackup(
        encrypted,
        restored,
        "long passphrase for test",
      );
      expect((await readFile(restored)).equals(original)).toBe(true);
      await expect(
        decryptProjectBackup(encrypted, restored, "long passphrase for test"),
      ).rejects.toThrow();
      expect((await readFile(restored)).equals(original)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
  it("supports an empty input and protects temporary output permissions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "khoonemoon-envelope-"));
    try {
      const source = join(dir, "source"),
        encrypted = join(dir, "encrypted"),
        restored = join(dir, "restored");
      await writeFile(source, "");
      await encryptProjectBackup(source, encrypted, "long passphrase for test");
      await decryptProjectBackup(
        encrypted,
        restored,
        "long passphrase for test",
      );
      expect((await readFile(restored)).length).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
  it("does not publish plaintext on wrong password, corruption, or truncation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "khoonemoon-envelope-"));
    try {
      const source = join(dir, "source"),
        encrypted = join(dir, "encrypted"),
        restored = join(dir, "restored");
      await writeFile(source, "private data");
      await encryptProjectBackup(source, encrypted, "long passphrase for test");
      await expect(
        decryptProjectBackup(
          encrypted,
          restored,
          "wrong password longer than 12",
        ),
      ).rejects.toThrow();
      const bytes = await readFile(encrypted);
      bytes[bytes.length - 1] ^= 1;
      await writeFile(encrypted, bytes);
      await expect(
        decryptProjectBackup(encrypted, restored, "long passphrase for test"),
      ).rejects.toThrow();
      await writeFile(encrypted, bytes.subarray(0, 3));
      await expect(
        decryptProjectBackup(encrypted, restored, "long passphrase for test"),
      ).rejects.toThrow();
      expect(await readdir(dir)).toEqual(
        expect.not.arrayContaining(["restored"]),
      );
      expect(
        (await readdir(dir)).filter((s) => s.includes(".partial-")),
      ).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
