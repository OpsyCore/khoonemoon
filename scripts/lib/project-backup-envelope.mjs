/** Streaming, authenticated envelope for operator-level project backups.
 * This is NOT the mobile household ZIP format. The caller must obtain the
 * project dump and Storage bytes separately and protect the passphrase.
 */
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2 as pbkdf2Callback,
  randomBytes,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, link, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { promisify } from "node:util";

const MAGIC = Buffer.from("KHPROJECT1\0", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const PBKDF2_ITERATIONS = 600_000;
// GCM limits one invocation to (2^39 - 256) bits. This format is not unlimited.
const MAX_CIPHERTEXT_BYTES = 2 ** 36 - 32;
const pbkdf2 = promisify(pbkdf2Callback);

async function keyFor(password, salt) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 1024
  )
    throw new Error("Backup passphrase must contain 12 to 1024 characters.");
  return pbkdf2(
    Buffer.from(password, "utf8"),
    salt,
    PBKDF2_ITERATIONS,
    32,
    "sha256",
  );
}
async function createTemp(output) {
  const path = `${output}.partial-${randomBytes(16).toString("hex")}`;
  return { path, handle: await open(path, "wx", 0o600) };
}
async function publish(temp, output) {
  // Hard-link creation is atomic and never replaces an existing file/symlink.
  await link(temp, output);
  await unlink(temp);
}

export async function encryptProjectBackup(input, output, password) {
  const salt = randomBytes(SALT_BYTES),
    iv = randomBytes(IV_BYTES);
  const header = Buffer.concat([MAGIC, salt, iv]);
  const key = await keyFor(password, salt);
  const temp = await createTemp(output);
  try {
    await temp.handle.writeFile(header);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(header);
    // Explicit fd position keeps the header and ciphertext in the same file.
    const writer = createWriteStream(temp.path, {
      fd: temp.handle.fd,
      autoClose: false,
      start: HEADER_BYTES,
    });
    let bytes = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > MAX_CIPHERTEXT_BYTES)
          callback(new Error("Project backup exceeds the GCM format limit."));
        else callback(null, chunk);
      },
    });
    await pipeline(createReadStream(input), limiter, cipher, writer);
    const result = await temp.handle.write(
      cipher.getAuthTag(),
      0,
      TAG_BYTES,
      (await temp.handle.stat()).size,
    );
    if (result.bytesWritten !== TAG_BYTES)
      throw new Error("Could not write the complete authentication tag.");
    await temp.handle.sync();
    await temp.handle.close();
    await publish(temp.path, output);
  } catch (error) {
    await temp.handle.close().catch(() => {});
    await unlink(temp.path).catch(() => {});
    throw error;
  } finally {
    key.fill(0);
  }
}

export async function decryptProjectBackup(input, output, password) {
  const source = await open(input, "r");
  let temp;
  let key;
  try {
    const size = (await source.stat()).size;
    if (
      size < HEADER_BYTES + TAG_BYTES ||
      size - HEADER_BYTES - TAG_BYTES > MAX_CIPHERTEXT_BYTES
    )
      throw new Error("Invalid encrypted project backup.");
    const header = Buffer.alloc(HEADER_BYTES),
      tag = Buffer.alloc(TAG_BYTES);
    if (
      (await source.read(header, 0, header.length, 0)).bytesRead !==
        header.length ||
      (await source.read(tag, 0, tag.length, size - TAG_BYTES)).bytesRead !==
        tag.length ||
      !header.subarray(0, MAGIC.length).equals(MAGIC)
    )
      throw new Error("Invalid encrypted project backup.");
    key = await keyFor(
      password,
      header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES),
    );
    const iv = header.subarray(MAGIC.length + SALT_BYTES);
    const cipher = createDecipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(header);
    cipher.setAuthTag(tag);
    temp = await createTemp(output);
    const reader =
      size === HEADER_BYTES + TAG_BYTES
        ? Readable.from([])
        : createReadStream(input, {
            fd: source.fd,
            autoClose: false,
            start: HEADER_BYTES,
            end: size - TAG_BYTES - 1,
          });
    const writer = createWriteStream(temp.path, {
      fd: temp.handle.fd,
      autoClose: false,
    });
    await pipeline(reader, cipher, writer);
    await temp.handle.sync();
    await temp.handle.close();
    await publish(temp.path, output);
  } catch (error) {
    if (temp) {
      await temp.handle.close().catch(() => {});
      await unlink(temp.path).catch(() => {});
    }
    throw error;
  } finally {
    key?.fill(0);
    await source.close();
  }
}
