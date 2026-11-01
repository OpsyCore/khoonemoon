/**
 * Streaming public-key envelope for an operator-level project archive.
 * The GitHub runner only receives a public key, never the recovery private key.
 * This module does not collect Supabase data or perform a restore.
 * Decryption stages plaintext in a mode-0600 temporary file; use an encrypted,
 * private filesystem and clean up residual files after a crash.
 */
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, open, unlink } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("KHPUBKEY1\0", "ascii");
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MAX_BYTES = 2 ** 36 - 32; // GCM maximum per invocation, not an unlimited format.
const PREFIX_BYTES = MAGIC.length + 2;
const oaep = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" };

function assertRsa(key) {
  if (
    key.asymmetricKeyType !== "rsa" ||
    (key.asymmetricKeyDetails?.modulusLength ?? 0) < 3072 ||
    key.asymmetricKeyDetails.modulusLength > 8192
  )
    throw new Error("A 3072 to 8192 bit RSA key is required.");
}
async function temporary(output) {
  const path = `${output}.partial-${randomBytes(16).toString("hex")}`;
  return { path, handle: await open(path, "wx", 0o600) };
}
async function commit(temp, output) {
  // Atomic and no overwrite (including symlinks); both must be on the same filesystem.
  await link(temp, output);
  await unlink(temp);
}
function limiter() {
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES)
        callback(new Error("Project archive exceeds the GCM format limit."));
      else callback(null, chunk);
    },
  });
}

export async function encryptForProjectOwner(input, output, publicKey) {
  const recipient = createPublicKey(publicKey);
  assertRsa(recipient);
  const contentKey = randomBytes(32);
  let temp;
  try {
    const wrapped = publicEncrypt({ key: recipient, ...oaep }, contentKey);
    const length = Buffer.alloc(2);
    length.writeUInt16BE(wrapped.length);
    const nonce = randomBytes(NONCE_BYTES);
    const header = Buffer.concat([MAGIC, length, wrapped, nonce]);
    temp = await temporary(output);
    await temp.handle.writeFile(header);
    const cipher = createCipheriv("aes-256-gcm", contentKey, nonce);
    cipher.setAAD(header);
    const writer = createWriteStream(temp.path, {
      fd: temp.handle.fd,
      autoClose: false,
      start: header.length,
    });
    await pipeline(createReadStream(input), limiter(), cipher, writer);
    const written = await temp.handle.write(
      cipher.getAuthTag(),
      0,
      TAG_BYTES,
      (await temp.handle.stat()).size,
    );
    if (written.bytesWritten !== TAG_BYTES)
      throw new Error("Could not write the complete authentication tag.");
    await temp.handle.sync();
    await temp.handle.close();
    await commit(temp.path, output);
  } catch (error) {
    if (temp) {
      await temp.handle.close().catch(() => {});
      await unlink(temp.path).catch(() => {});
    }
    throw error;
  } finally {
    contentKey.fill(0);
  }
}

export async function decryptForProjectOwner(input, output, privateKey) {
  const recipient = createPrivateKey(privateKey);
  assertRsa(recipient);
  const source = await open(input, "r");
  let temp, contentKey;
  try {
    const size = (await source.stat()).size;
    const prefix = Buffer.alloc(PREFIX_BYTES);
    if (
      size < PREFIX_BYTES + NONCE_BYTES + TAG_BYTES ||
      (await source.read(prefix, 0, PREFIX_BYTES, 0)).bytesRead !==
        PREFIX_BYTES ||
      !prefix.subarray(0, MAGIC.length).equals(MAGIC)
    )
      throw new Error("Invalid project archive.");
    const wrappedLength = prefix.readUInt16BE(MAGIC.length);
    if (
      wrappedLength < 384 ||
      wrappedLength > 1024 ||
      wrappedLength !== recipient.asymmetricKeyDetails.modulusLength / 8
    )
      throw new Error("Invalid project archive.");
    const headerLength = PREFIX_BYTES + wrappedLength + NONCE_BYTES;
    if (
      size < headerLength + TAG_BYTES ||
      size - headerLength - TAG_BYTES > MAX_BYTES
    )
      throw new Error("Invalid project archive.");
    const header = Buffer.alloc(headerLength),
      tag = Buffer.alloc(TAG_BYTES);
    if (
      (await source.read(header, 0, headerLength, 0)).bytesRead !==
        headerLength ||
      (await source.read(tag, 0, TAG_BYTES, size - TAG_BYTES)).bytesRead !==
        TAG_BYTES
    )
      throw new Error("Invalid project archive.");
    // Recheck the full header because the file can change between reads.
    if (!header.subarray(0, PREFIX_BYTES).equals(prefix))
      throw new Error("Invalid project archive.");
    contentKey = privateDecrypt(
      { key: recipient, ...oaep },
      header.subarray(PREFIX_BYTES, PREFIX_BYTES + wrappedLength),
    );
    if (contentKey.length !== 32) throw new Error("Invalid project archive.");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      contentKey,
      header.subarray(headerLength - NONCE_BYTES),
    );
    cipher.setAAD(header);
    cipher.setAuthTag(tag);
    temp = await temporary(output);
    const reader =
      size === headerLength + TAG_BYTES
        ? Readable.from([])
        : createReadStream(input, {
            fd: source.fd,
            autoClose: false,
            start: headerLength,
            end: size - TAG_BYTES - 1,
          });
    const writer = createWriteStream(temp.path, {
      fd: temp.handle.fd,
      autoClose: false,
    });
    await pipeline(reader, cipher, writer);
    await temp.handle.sync();
    await temp.handle.close();
    await commit(temp.path, output);
  } catch (error) {
    if (temp) {
      await temp.handle.close().catch(() => {});
      await unlink(temp.path).catch(() => {});
    }
    throw error;
  } finally {
    contentKey?.fill(0);
    await source.close();
  }
}
