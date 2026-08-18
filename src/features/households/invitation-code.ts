import { createHash, randomBytes } from "node:crypto";

export function generateInvitationCode() {
  return randomBytes(24).toString("base64url");
}

export function hashInvitationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
