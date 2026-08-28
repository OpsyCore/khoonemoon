import { z } from "zod";
import {
  SEARCH_TYPE_FILTERS,
  type SearchTypeFilter,
} from "@/features/search/types";

export const SEARCH_QUERY_MAX = 80;
export const SEARCH_RESULT_LIMIT = 40;
export const SEARCH_PER_TYPE_LIMIT = 15;

export function normalizeSearchQuery(raw: string | null | undefined) {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function sanitizeSearchTerm(raw: string) {
  return normalizeSearchQuery(raw)
    .replace(/[%_,.()\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedSearchQuery =
  | { ok: true; query: string; type: SearchTypeFilter }
  | { ok: false; code: "EMPTY" | "TOO_LONG"; type: SearchTypeFilter };

export function parseSearchQuery({
  q,
  type,
}: {
  q: string | null | undefined;
  type?: string | null;
}): ParsedSearchQuery {
  const typeResult = z.enum(SEARCH_TYPE_FILTERS).safeParse(type || "all");
  const parsedType: SearchTypeFilter = typeResult.success
    ? typeResult.data
    : "all";

  const normalized = normalizeSearchQuery(q);
  if (!normalized) {
    return { ok: false, code: "EMPTY", type: parsedType };
  }
  if (normalized.length > SEARCH_QUERY_MAX) {
    return { ok: false, code: "TOO_LONG", type: parsedType };
  }

  const query = sanitizeSearchTerm(normalized);
  if (!query) {
    return { ok: false, code: "EMPTY", type: parsedType };
  }

  return { ok: true, query, type: parsedType };
}

export function toOrIlikeFilter(columns: readonly string[], term: string) {
  return columns.map((column) => `${column}.ilike.%${term}%`).join(",");
}

export function readSearchQueryParam(
  value: string | string[] | undefined | null,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  return normalizeSearchQuery(raw);
}

export function applySearchQueryToPath({
  pathname,
  search,
  query,
}: {
  pathname: string;
  search: string;
  query: string;
}) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const normalized = normalizeSearchQuery(query);
  if (normalized) {
    params.set("q", normalized);
  } else {
    params.delete("q");
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
