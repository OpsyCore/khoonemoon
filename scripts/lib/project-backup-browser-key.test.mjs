import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  createProjectRecoveryKey,
  openProjectRecoveryKey,
} from "../../src/features/export/project-recovery-key";
import { encryptStreamForProjectOwner } from "./project-backup-public-key.mjs";

describe("browser key and streaming project envelope", () => {
  it("unwraps the runner envelope with a locally generated and protected key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "project-key-test-"));
    try {
      const { publicKeyPem, encryptedPrivateKey } =
        await createProjectRecoveryKey("fixture recovery passphrase");
      const key = await openProjectRecoveryKey(
        encryptedPrivateKey,
        "fixture recovery passphrase",
      );
      const path = join(dir, "fixture.enc");
      const message = Buffer.from("synthetic project backup");
      await encryptStreamForProjectOwner(
        Readable.from([message]),
        path,
        publicKeyPem,
      );
      const envelope = await readFile(path);
      expect(envelope.subarray(0, 10).toString()).toBe("KHPUBKEY1\0");
      const wrappedLength = envelope.readUInt16BE(10);
      const headerLength = 12 + wrappedLength + 12;
      const contentKey = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        key,
        envelope.subarray(12, 12 + wrappedLength),
      );
      const aes = await crypto.subtle.importKey(
        "raw",
        contentKey,
        "AES-GCM",
        false,
        ["decrypt"],
      );
      const decoded = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: envelope.subarray(headerLength - 12, headerLength),
          additionalData: envelope.subarray(0, headerLength),
        },
        aes,
        envelope.subarray(headerLength),
      );
      expect(Buffer.from(decoded).equals(message)).toBe(true);
      envelope[headerLength] ^= 1;
      await expect(
        crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: envelope.subarray(headerLength - 12, headerLength),
            additionalData: envelope.subarray(0, headerLength),
          },
          aes,
          envelope.subarray(headerLength),
        ),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
