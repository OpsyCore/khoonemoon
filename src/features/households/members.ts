import type { SupabaseServerClient } from "@/lib/api/session";
import type { HouseholdMember, HouseholdRole } from "./types";

/** household_members.user_id references auth.users, not profiles: PostgREST
 * cannot embed profiles. Fetch each table under the caller's RLS instead. */
export async function loadHouseholdMembers(
  supabase: SupabaseServerClient,
  householdId: string,
) {
  const result = await supabase
    .from("household_members")
    .select("id, user_id, role, joined_at, left_at")
    .eq("household_id", householdId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });
  if (result.error)
    return { data: [] as HouseholdMember[], error: result.error };
  const rows = result.data ?? [];
  if (!rows.length) return { data: [] as HouseholdMember[], error: null };
  const profiles = await supabase
    .from("profiles")
    .select("id, full_name")
    .in(
      "id",
      rows.map((row) => row.user_id),
    );
  if (profiles.error)
    return { data: [] as HouseholdMember[], error: profiles.error };
  const names = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const data: HouseholdMember[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role as HouseholdRole,
    joined_at: row.joined_at,
    left_at: row.left_at,
    profiles: names.has(row.user_id)
      ? [{ full_name: names.get(row.user_id) ?? "کاربر" }]
      : null,
  }));
  return { data, error: null };
}
