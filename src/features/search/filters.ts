/**
 * Search filters ("فیلتر جست‌وجو").
 *
 * The search panel could only show whatever the RPC returned: no way to narrow a
 * mixed result list to bills, or to "only what happened this month". Filtering
 * happens on the client, so narrowing never costs another round-trip and the
 * server contract (`search_workspace`) stays untouched.
 */

export type SearchKind =
  "task" | "event" | "shopping_item" | "finance" | "chore";

export type SearchResult = {
  kind: SearchKind;
  entity_id: string;
  title: string;
  subtitle: string | null;
  happened_at: string | null;
  status: string | null;
};

export type TimeRange = "ANY" | "WEEK" | "MONTH" | "YEAR";

export type SearchFilters = {
  kinds: SearchKind[];
  range: TimeRange;
};

export const ALL_KINDS: SearchKind[] = [
  "task",
  "event",
  "shopping_item",
  "finance",
  "chore",
];

export const DEFAULT_FILTERS: SearchFilters = { kinds: [], range: "ANY" };

export const RANGE_LABELS: Record<TimeRange, string> = {
  ANY: "همه",
  WEEK: "۷ روز",
  MONTH: "۳۰ روز",
  YEAR: "۱ سال",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_DAYS: Record<Exclude<TimeRange, "ANY">, number> = {
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

export function isSearchKind(value: unknown): value is SearchKind {
  return typeof value === "string" && ALL_KINDS.includes(value as SearchKind);
}

/**
 * Reads filters from a query string (`?kind=finance&kind=task&range=MONTH`).
 * Unknown values are ignored instead of throwing: a stale bookmark must still
 * render a usable page.
 */
export function parseSearchFilters(params: URLSearchParams): SearchFilters {
  const rawKinds = params.getAll("kind");
  const kinds: SearchKind[] = [];

  for (const value of rawKinds) {
    const candidate = value.includes(",") ? value.split(",") : [value];

    for (const part of candidate) {
      const trimmed = part.trim();
      if (isSearchKind(trimmed) && !kinds.includes(trimmed))
        kinds.push(trimmed);
    }
  }

  // Canonical order, so a URL and a click sequence produce identical state.
  const ordered = ALL_KINDS.filter((kind) => kinds.includes(kind));

  const rawRange = (params.get("range") ?? "").toUpperCase();
  const range: TimeRange =
    rawRange && rawRange in RANGE_LABELS ? (rawRange as TimeRange) : "ANY";

  return { kinds: ordered, range };
}

/** Serialises filters, leaving defaults out so the default URL stays clean. */
export function toSearchParams({
  query,
  filters,
}: {
  query?: string;
  filters: SearchFilters;
}): string {
  const params = new URLSearchParams();

  if (query && query.trim()) params.set("q", query.trim());
  for (const kind of filters.kinds) params.append("kind", kind);

  if (filters.range !== "ANY") params.set("range", filters.range);

  return params.toString();
}

/**
 * A result passes when its kind is selected (or nothing is selected, which means
 * "all kinds") and its timestamp falls inside the range.
 *
 * A result without a timestamp cannot be proven old, so it is kept for every
 * range — hiding it would mean losing a match for a reason the user cannot see.
 */
export function matchesFilters({
  result,
  filters,
  now,
}: {
  result: SearchResult;
  filters: SearchFilters;
  now: Date;
}): boolean {
  if (filters.kinds.length > 0 && !filters.kinds.includes(result.kind)) {
    return false;
  }

  if (filters.range === "ANY") return true;

  if (!result.happened_at) return true;

  const happened = new Date(result.happened_at).getTime();
  if (Number.isNaN(happened)) return true;

  const days = RANGE_DAYS[filters.range];
  // Slightly generous at the far end so "today" is always included regardless
  // of the timezone the browser reports.
  return (
    happened >= now.getTime() - days * DAY_MS &&
    happened <= now.getTime() + DAY_MS
  );
}

export function filterResults({
  results,
  filters,
  now,
}: {
  results: SearchResult[];
  filters: SearchFilters;
  now: Date;
}): SearchResult[] {
  return results.filter((result) => matchesFilters({ result, filters, now }));
}

/** How many results each kind would contribute, ignoring the kind filter. */
export function countByKind({
  results,
  filters,
  now,
}: {
  results: SearchResult[];
  filters: SearchFilters;
  now: Date;
}): Record<SearchKind, number> {
  const counts = Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, 0]),
  ) as Record<SearchKind, number>;

  // Count with the time range applied but the kind filter relaxed, so the chips
  // can show "مالی (۳)" without the numbers collapsing to zero once selected.
  const relaxed: SearchFilters = { ...filters, kinds: [] };

  for (const result of results) {
    if (matchesFilters({ result, filters: relaxed, now })) {
      counts[result.kind] += 1;
    }
  }

  return counts;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filters.kinds.length > 0 || filters.range !== "ANY";
}

/** Toggles a kind on/off, keeping the canonical order stable. */
export function toggleKind({
  filters,
  kind,
}: {
  filters: SearchFilters;
  kind: SearchKind;
}): SearchFilters {
  const selected = filters.kinds.includes(kind)
    ? filters.kinds.filter((entry) => entry !== kind)
    : [...filters.kinds, kind];

  return {
    ...filters,
    kinds: ALL_KINDS.filter((entry) => selected.includes(entry)),
  };
}
