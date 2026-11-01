import type { SearchFilters } from "@/features/search/filters";
export function searchUrl(
  url: URL,
  query: string,
  filters: SearchFilters,
): URL {
  const next = new URL(url);
  next.searchParams.delete("search_q");
  next.searchParams.delete("search_kind");
  next.searchParams.delete("search_range");
  if (query) next.searchParams.set("search_q", query);
  filters.kinds.forEach((kind) =>
    next.searchParams.append("search_kind", kind),
  );
  if (filters.range !== "ANY")
    next.searchParams.set("search_range", filters.range);
  next.searchParams.set("page", "search");
  return next;
}
