/** Versioned authenticated envelope around a bounded ZIP. The password never leaves the device. */
const MAGIC = new TextEncoder().encode("KHOONE1\0");
const SALT_SIZE = 16;
const NONCE_SIZE = 12;
const HEADER_SIZE = MAGIC.length + SALT_SIZE + NONCE_SIZE;
const MAX_ZIP_SIZE = 16 * 1024 * 1024;
export const MAX_ENCRYPTED_BACKUP = MAX_ZIP_SIZE + HEADER_SIZE + 16;
const ITERATIONS = 600_000;

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  return (
    bytes.length >= MAGIC.length &&
    MAGIC.every((value, i) => bytes[i] === value)
  );
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle)
    throw new Error("رمزگذاری در این دستگاه پشتیبانی نمی‌شود.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt).buffer,
      iterations: ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(
  bytes: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (password.length < 12 || password.length > 1024)
    throw new Error("رمز پشتیبان باید حداقل ۱۲ و حداکثر ۱۰۲۴ نویسه باشد.");
  if (bytes.length > MAX_ZIP_SIZE)
    throw new Error("فایل پشتیبان از حد مجاز بیشتر است.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC);
  header.set(salt, MAGIC.length);
  header.set(nonce, MAGIC.length + SALT_SIZE);
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: header },
    key,
    new Uint8Array(bytes).buffer,
  );
  const out = new Uint8Array(header.length + encrypted.byteLength);
  out.set(header);
  out.set(new Uint8Array(encrypted), header.length);
  return out;
}

export async function decryptBackup(
  bytes: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (
    !isEncryptedBackup(bytes) ||
    bytes.length < HEADER_SIZE + 16 ||
    bytes.length > MAX_ENCRYPTED_BACKUP ||
    password.length > 1024
  )
    throw new Error("فایل پشتیبان رمزگذاری‌شده معتبر نیست.");
  const header = bytes.slice(0, HEADER_SIZE);
  const salt = header.slice(MAGIC.length, MAGIC.length + SALT_SIZE);
  const nonce = header.slice(MAGIC.length + SALT_SIZE);
  const key = await deriveKey(password, salt);
  try {
    const result = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: header },
      key,
      new Uint8Array(bytes.subarray(HEADER_SIZE)).buffer,
    );
    return new Uint8Array(result);
  } catch {
    throw new Error("رمز پشتیبان اشتباه است یا فایل آسیب دیده است.");
  }
}
