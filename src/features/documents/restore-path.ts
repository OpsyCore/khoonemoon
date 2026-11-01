import type { SupabaseClient } from "@supabase/supabase-js";

/** Retired paths can never be reused. Preserve deterministic retry paths unless
 * an explicitly cleaned-up orphan retired that path, then use a fresh name. */
export async function availableRestorePath(
  client: SupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await client.rpc("document_cleanup_is_retired", {
    p_path: path,
  });
  if (error || typeof data !== "boolean")
    throw new Error("بررسی مسیر بازیابی مدرک ناموفق بود.");
  if (!data) return path;
  return path.replace(
    /\/restore(\.[a-z]+)$/,
    `/restore-${crypto.randomUUID()}$1`,
  );
}
