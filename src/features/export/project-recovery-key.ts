/**
 * Create the recovery key locally. The public half can be shared; the encrypted
 * private half and its passphrase must stay with the project operator. This
 * does not itself create a project backup or authorize a server workflow.
 */
import { decryptBackup, encryptBackup } from "./backup-encryption";

const MARKER = "khoonemoon-project-recovery-key-v1";
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function pem(label: string, bytes: Uint8Array): string {
  const body = base64(bytes)
    .match(/.{1,64}/g)
    ?.join("\n");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export async function createProjectRecoveryKey(password: string): Promise<{
  publicKeyPem: string;
  encryptedPrivateKey: Uint8Array;
}> {
  if (password.length < 12 || password.length > 1024)
    throw new Error("رمز کلید باید حداقل ۱۲ و حداکثر ۱۰۲۴ نویسه باشد.");
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const publicBytes = new Uint8Array(
    await crypto.subtle.exportKey("spki", pair.publicKey),
  );
  const privateBytes = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  let serialized: Uint8Array | undefined;
  try {
    serialized = new TextEncoder().encode(
      JSON.stringify({ format: MARKER, pkcs8: base64(privateBytes) }),
    );
    return {
      publicKeyPem: pem("PUBLIC KEY", publicBytes),
      encryptedPrivateKey: await encryptBackup(serialized, password),
    };
  } finally {
    privateBytes.fill(0);
    serialized?.fill(0);
  }
}

/** Use only in a trusted local recovery flow; never upload the returned key. */
export async function openProjectRecoveryKey(
  encrypted: Uint8Array,
  password: string,
): Promise<CryptoKey> {
  const plain = await decryptBackup(encrypted, password);
  let bytes: Uint8Array | undefined;
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(plain),
    );
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !("format" in value) ||
      value.format !== MARKER ||
      !("pkcs8" in value) ||
      typeof value.pkcs8 !== "string" ||
      value.pkcs8.length > 10000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value.pkcs8)
    )
      throw new Error("invalid key");
    const binary = atob(value.pkcs8);
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(bytes).buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
    const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
    if (algorithm.modulusLength !== 3072) throw new Error("invalid key");
    return key;
  } catch {
    throw new Error("فایل کلید بازیابی معتبر نیست.");
  } finally {
    plain.fill(0);
    bytes?.fill(0);
  }
}
