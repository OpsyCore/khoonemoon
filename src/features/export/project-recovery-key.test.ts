import { describe, expect, it } from "vitest";
import {
  createProjectRecoveryKey,
  openProjectRecoveryKey,
} from "./project-recovery-key";

describe("project recovery key", () => {
  it("creates a locally encrypted private key interoperable with its public key", async () => {
    const { publicKeyPem, encryptedPrivateKey } =
      await createProjectRecoveryKey("fixture recovery passphrase");
    expect(publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(new TextDecoder().decode(encryptedPrivateKey)).not.toContain(
      "PRIVATE KEY",
    );
    const body = publicKeyPem
      .replace(/-----[^-]+-----/g, "")
      .replace(/\s/g, "");
    const publicDer = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    const pub = await crypto.subtle.importKey(
      "spki",
      publicDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
    const priv = await openProjectRecoveryKey(
      encryptedPrivateKey,
      "fixture recovery passphrase",
    );
    const message = new TextEncoder().encode("fixture secret");
    const wrapped = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      pub,
      message,
    );
    expect(
      new TextDecoder().decode(
        await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, wrapped),
      ),
    ).toBe("fixture secret");
    await expect(
      openProjectRecoveryKey(encryptedPrivateKey, "incorrect passphrase"),
    ).rejects.toThrow();
  }, 30000);
  it("requires a long passphrase", async () => {
    await expect(createProjectRecoveryKey("short")).rejects.toThrow();
  });
});
