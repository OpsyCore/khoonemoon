import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  updateHouseholdSchema,
} from "./schemas";
import type {
  HouseholdInvitation,
  HouseholdRole,
  HouseholdSummary,
} from "./types";

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
    async details(id: string, userId: string) {
      const [house, members, names, invitations] = await Promise.all([
        client
          .from("households")
          .select("id, name, created_by, created_at, updated_at")
          .eq("id", id)
          .single(),
        client
          .from("household_members")
          .select("user_id, role")
          .eq("household_id", id)
          .is("left_at", null)
          .order("joined_at"),
        client.rpc("household_member_names", { target_household_id: id }),
        client
          .from("household_invitations")
          .select("id, status, expires_at, created_at")
          .eq("household_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (
        house.error ||
        members.error ||
        names.error ||
        invitations.error ||
        !house.data
      )
        throw new Error("دریافت اطلاعات خانه ناموفق بود.");
      const memberRows = (members.data ?? []) as {
        user_id: string;
        role: HouseholdRole;
      }[];
      const memberNames = new Map(
        ((names.data ?? []) as { id: string; full_name: string | null }[]).map(
          (n) => [n.id, n.full_name],
        ),
      );
      return {
        house: house.data as HouseholdSummary,
        role: memberRows.find((m) => m.user_id === userId)?.role ?? null,
        members: memberRows.map((m) => ({
          ...m,
          name: memberNames.get(m.user_id) || "کاربر",
        })),
        invitations: (invitations.data ?? []) as HouseholdInvitation[],
      };
    },
    async rename(id: string, name: string): Promise<void> {
      const parsed = updateHouseholdSchema.parse({ name });
      const { data, error } = await client
        .from("households")
        .update({ name: parsed.name })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("تغییر نام خانه انجام نشد.");
    },
    async cancel(invitationId: string): Promise<void> {
      const { error } = await client.rpc("cancel_household_invitation", {
        p_invitation_id: invitationId,
      });
      if (error) throw new Error("لغو دعوت‌نامه انجام نشد.");
    },
    async leave(): Promise<void> {
      const { data, error } = await client.rpc("leave_current_household");
      if (error || data !== true) throw new Error("ترک خانه انجام نشد.");
    },
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
