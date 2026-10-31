import type { SupabaseClient } from "@supabase/supabase-js";
import { isSearchKind, type SearchResult } from "./filters";

/** Executes the SECURITY INVOKER search RPC under the signed-in user's RLS. */
export async function searchWorkspace(
  client: SupabaseClient,
  input: string,
): Promise<SearchResult[]> {
  const query = input.trim();
  if (query.length < 2) return [];
  if (query.length > 100) throw new Error("عبارت جستجو طولانی است.");
  const { data, error } = await client.rpc("search_workspace", {
    p_query: query,
    p_limit: 50,
  });
  if (error) throw new Error("جستجو ناموفق بود؛ اتصال اینترنت را بررسی کنید.");
  return (data ?? []).filter((row: SearchResult) =>
    isSearchKind(row.kind),
  ) as SearchResult[];
}
