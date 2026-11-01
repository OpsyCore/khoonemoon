/** Package a capture to an encrypted archive without creating a plaintext tar. */
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { link, unlink } from "node:fs/promises";
import { encryptStreamForProjectOwner } from "./project-backup-public-key.mjs";

export async function packageProjectCapture(directory, output, publicKey) {
  const temporary = `${output}.staged-${randomBytes(16).toString("hex")}`;
  const tar = spawn("tar", ["-C", directory, "-cf", "-", "."], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  // Attach a consumer synchronously: Node drains child stdout on exit, even
  // before asynchronous key setup has completed.
  const buffered = new PassThrough();
  tar.stdout.pipe(buffered);
  const completed = new Promise((resolve, reject) => {
    tar.once("error", () =>
      reject(new Error("Could not start the archive process.")),
    );
    tar.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error("Archive process failed.")),
    );
  });
  // Register a handler immediately, even if encryption fails before tar exits.
  const result = completed.then(
    () => null,
    (error) => error,
  );
  try {
    await encryptStreamForProjectOwner(buffered, temporary, publicKey);
    const failure = await result;
    if (failure) throw failure;
    await link(temporary, output); // atomic, refuses overwrite
    await unlink(temporary);
  } catch (error) {
    tar.kill();
    await result;
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
