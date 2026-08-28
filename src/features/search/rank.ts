import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
  type SearchResult,
} from "@/features/search/types";

const TYPE_ORDER = Object.fromEntries(
  SEARCH_ENTITY_TYPES.map((type, index) => [type, index]),
) as Record<SearchEntityType, number>;

export function scoreSearchMatch(
  query: string,
  title: string,
  extra: string | null | undefined,
) {
  const q = query.toLowerCase();
  const t = title.trim().toLowerCase();
  const e = (extra ?? "").trim().toLowerCase();

  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  if (e.includes(q)) return 3;
  return 4;
}

export function matchesSearchQuery(
  query: string,
  title: string,
  extra: string | null | undefined,
) {
  return scoreSearchMatch(query, title, extra) < 4;
}

export function mergeSearchResults(
  query: string,
  incoming: SearchResult[],
): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const item of incoming) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    if (!matchesSearchQuery(query, item.title, item.snippet)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.sort((a, b) => {
    const scoreDiff =
      scoreSearchMatch(query, a.title, a.snippet) -
      scoreSearchMatch(query, b.title, b.snippet);
    if (scoreDiff !== 0) return scoreDiff;
    const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.title.localeCompare(b.title, "fa");
  });
}

export function snippetOf(...parts: Array<string | null | undefined>) {
  for (const part of parts) {
    const value = part?.trim();
    if (value) return value;
  }
  return null;
}
