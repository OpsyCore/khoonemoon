import type { SupabaseClient } from "@supabase/supabase-js";
import { createHouseholdSchema, joinHouseholdSchema } from "./schemas";

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

export function directHousehold(client: SupabaseClient) {
  return {
    async create(name: string): Promise<string> {
      const parsed = createHouseholdSchema.parse({ name });
      const { data, error } = await client.rpc("create_household", {
        p_name: parsed.name,
      });
      if (error || typeof data !== "string")
        throw new Error("ایجاد خانه انجام نشد.");
      return data;
    },
    async join(code: string): Promise<string> {
      const parsed = joinHouseholdSchema.parse({ code });
      const hash = await hashInvitationCodeBrowser(parsed.code);
      const { data, error } = await client.rpc(
        "join_household_with_invitation",
        { p_code_hash: hash },
      );
      if (error || typeof data !== "string")
        throw new Error("عضویت در خانه انجام نشد.");
      return data;
    },
    async invite(): Promise<{ code: string; expiresAt: string }> {
      const code = generateInvitationCodeBrowser();
      const hash = await hashInvitationCodeBrowser(code);
      const expiresAt = new Date(
        Date.now() + 72 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await client.rpc("create_household_invitation", {
        p_code_hash: hash,
        p_expires_at: expiresAt,
      });
      if (error || !data) throw new Error("ایجاد دعوت‌نامه انجام نشد.");
      return { code, expiresAt };
    },
  };
}
