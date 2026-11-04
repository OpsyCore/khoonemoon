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

/** Page and count after server-side filters, never before the limit. */
export async function searchWorkspaceFiltered(
  client: SupabaseClient,
  input: string,
  filters: import("./filters").SearchFilters,
  now: Date,
  offset = 0,
): Promise<{
  results: SearchResult[];
  counts: Partial<Record<import("./filters").SearchKind, number>>;
  total: number;
}> {
  const query = input.trim();
  if (
    query.length < 2 ||
    query.length > 100 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 10000
  )
    throw new Error("عبارت یا صفحه جستجو نامعتبر است.");
  const days = { ANY: 0, WEEK: 7, MONTH: 30, YEAR: 365 }[filters.range];
  const { data, error } = await client.rpc("search_workspace_filtered", {
    p_query: query,
    p_kinds: filters.kinds,
    p_since: days
      ? new Date(now.getTime() - days * 86400000).toISOString()
      : null,
    p_until: days ? new Date(now.getTime() + 86400000).toISOString() : null,
    p_offset: offset,
  });
  if (
    error ||
    !data ||
    !Array.isArray(data.results) ||
    typeof data.total !== "number"
  )
    throw new Error("جستجو ناموفق بود؛ اتصال اینترنت را بررسی کنید.");
  return {
    results: data.results.filter((row: SearchResult) => isSearchKind(row.kind)),
    counts: data.counts ?? {},
    total: data.total,
  };
}
