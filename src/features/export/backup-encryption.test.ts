import { describe, expect, it } from "vitest";
import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  MAX_ENCRYPTED_BACKUP,
} from "./backup-encryption";

describe("encrypted mobile backup", () => {
  it("encrypts and decrypts locally with random salt and nonce", async () => {
    const plain = new TextEncoder().encode("private household data");
    const password = "this is a long password";
    const first = await encryptBackup(plain, password);
    const second = await encryptBackup(plain, password);
    expect(isEncryptedBackup(first)).toBe(true);
    expect(first).not.toEqual(second);
    expect(new TextDecoder().decode(first)).not.toContain(
      "private household data",
    );
    expect(await decryptBackup(first, password)).toEqual(plain);
    await expect(decryptBackup(first, "incorrect password")).rejects.toThrow();
    const tampered = first.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptBackup(tampered, password)).rejects.toThrow();
    const alteredHeader = first.slice();
    alteredHeader[9] ^= 1;
    await expect(decryptBackup(alteredHeader, password)).rejects.toThrow();
  });
  it("rejects weak passwords and invalid lengths", async () => {
    await expect(encryptBackup(new Uint8Array(), "short")).rejects.toThrow();
    await expect(
      decryptBackup(new Uint8Array([1, 2]), "anything"),
    ).rejects.toThrow();
    await expect(
      decryptBackup(new Uint8Array(MAX_ENCRYPTED_BACKUP + 1), "anything"),
    ).rejects.toThrow();
  });
});
