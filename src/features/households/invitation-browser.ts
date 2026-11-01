/** Same SHA-256 encoding as the server, without requiring node:crypto. */
export async function hashInvitationCodeBrowser(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** 24 random bytes, encoded the same way as Node's base64url. */
export function generateInvitationCodeBrowser(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
