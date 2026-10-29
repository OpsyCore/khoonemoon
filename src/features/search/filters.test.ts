import { describe, expect, it } from "vitest";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  countByKind,
  filterResults,
  hasActiveFilters,
  matchesFilters,
  parseSearchFilters,
  toSearchParams,
  toggleKind,
  type SearchFilters,
  type SearchResult,
} from "@/features/search/filters";

const NOW = new Date("2026-10-29T12:00:00.000Z");

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    kind: "task",
    entity_id: "e-1",
    title: "پرداخت قبض",
    subtitle: null,
    happened_at: "2026-10-28T09:00:00.000Z",
    status: null,
    ...overrides,
  };
}

const ALL: SearchFilters = { kinds: [], range: "ANY" };

describe("parseSearchFilters", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseSearchFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("reads repeated kind parameters", () => {
    const filters = parseSearchFilters(
      new URLSearchParams("kind=finance&kind=task"),
    );

    // Canonical order, not the order in the URL.
    expect(filters.kinds).toEqual(["task", "finance"]);
    expect(filters.range).toBe("ANY");
  });

  it("reads a comma separated kind list", () => {
    expect(
      parseSearchFilters(new URLSearchParams("kind=chore,event")).kinds,
    ).toEqual(["event", "chore"]);
  });

  it("ignores unknown kinds and duplicates", () => {
    const filters = parseSearchFilters(
      new URLSearchParams("kind=finance&kind=alien&kind=finance"),
    );

    expect(filters.kinds).toEqual(["finance"]);
  });

  it("parses the time range case-insensitively", () => {
    expect(parseSearchFilters(new URLSearchParams("range=month")).range).toBe(
      "MONTH",
    );
  });

  it("falls back to ANY for an unknown range instead of throwing", () => {
    expect(parseSearchFilters(new URLSearchParams("range=decade")).range).toBe(
      "ANY",
    );
  });
});

describe("toSearchParams", () => {
  it("omits defaults to keep the URL clean", () => {
    expect(toSearchParams({ query: "", filters: ALL })).toBe("");
  });

  it("writes the query and filters", () => {
    const params = toSearchParams({
      query: "  برق ",
      filters: { kinds: ["finance", "task"], range: "WEEK" },
    });

    const parsed = new URLSearchParams(params);
    expect(parsed.get("q")).toBe("برق");
    expect(parsed.getAll("kind")).toEqual(["finance", "task"]);
    expect(parsed.get("range")).toBe("WEEK");
  });

  it("round-trips through parseSearchFilters", () => {
    const filters: SearchFilters = { kinds: ["event", "chore"], range: "YEAR" };
    const roundTripped = parseSearchFilters(
      new URLSearchParams(toSearchParams({ filters })),
    );

    expect(roundTripped).toEqual(filters);
  });
});

describe("matchesFilters", () => {
  it("accepts everything when no filters are set", () => {
    expect(matchesFilters({ result: result(), filters: ALL, now: NOW })).toBe(true);
  });

  it("filters by kind", () => {
    const filters: SearchFilters = { kinds: ["finance"], range: "ANY" };

    expect(
      matchesFilters({ result: result({ kind: "task" }), filters, now: NOW }),
    ).toBe(false);
    expect(
      matchesFilters({ result: result({ kind: "finance" }), filters, now: NOW }),
    ).toBe(true);
  });

  it("filters by time range", () => {
    const week: SearchFilters = { kinds: [], range: "WEEK" };

    expect(
      matchesFilters({
        result: result({ happened_at: "2026-10-27T09:00:00.000Z" }),
        filters: week,
        now: NOW,
      }),
    ).toBe(true);

    expect(
      matchesFilters({
        result: result({ happened_at: "2026-09-01T09:00:00.000Z" }),
        filters: week,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("keeps results without a timestamp for every range", () => {
    const year: SearchFilters = { kinds: [], range: "YEAR" };

    expect(
      matchesFilters({ result: result({ happened_at: null }), filters: year, now: NOW }),
    ).toBe(true);
    expect(
      matchesFilters({
        result: result({ happened_at: "not-a-date" }),
        filters: year,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("includes a result that happens later today", () => {
    const week: SearchFilters = { kinds: [], range: "WEEK" };

    expect(
      matchesFilters({
        result: result({ happened_at: "2026-10-29T23:00:00.000Z" }),
        filters: week,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("combines kind and range", () => {
    const filters: SearchFilters = { kinds: ["finance"], range: "WEEK" };

    expect(
      matchesFilters({
        result: result({ kind: "finance", happened_at: "2026-09-01T09:00:00.000Z" }),
        filters,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      matchesFilters({
        result: result({ kind: "finance", happened_at: "2026-10-28T09:00:00.000Z" }),
        filters,
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("filterResults", () => {
  it("keeps the original order of the surviving results", () => {
    const results = [
      result({ entity_id: "1", kind: "task" }),
      result({ entity_id: "2", kind: "finance" }),
      result({ entity_id: "3", kind: "task" }),
    ];

    const filtered = filterResults({
      results,
      filters: { kinds: ["task"], range: "ANY" },
      now: NOW,
    });

    expect(filtered.map((entry) => entry.entity_id)).toEqual(["1", "3"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(
      filterResults({
        results: [result({ kind: "task" })],
        filters: { kinds: ["chore"], range: "ANY" },
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe("countByKind", () => {
  it("counts each kind while ignoring the kind filter", () => {
    const results = [
      result({ kind: "task" }),
      result({ kind: "task" }),
      result({ kind: "finance" }),
      result({ kind: "chore" }),
    ];

    const counts = countByKind({
      results,
      filters: { kinds: ["finance"], range: "ANY" },
      now: NOW,
    });

    expect(counts).toEqual({
      task: 2,
      event: 0,
      shopping_item: 0,
      finance: 1,
      chore: 1,
    });
  });

  it("respects the time range", () => {
    const counts = countByKind({
      results: [
        result({ kind: "task", happened_at: "2026-10-28T09:00:00.000Z" }),
        result({ kind: "task", happened_at: "2026-01-01T09:00:00.000Z" }),
      ],
      filters: { kinds: [], range: "WEEK" },
      now: NOW,
    });

    expect(counts.task).toBe(1);
  });

  it("returns zeroes for an empty result set", () => {
    const counts = countByKind({ results: [], filters: ALL, now: NOW });

    for (const kind of ALL_KINDS) expect(counts[kind]).toBe(0);
  });
});

describe("hasActiveFilters", () => {
  it("is false for defaults", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("is true when a kind or range is set", () => {
    expect(hasActiveFilters({ kinds: ["task"], range: "ANY" })).toBe(true);
    expect(hasActiveFilters({ kinds: [], range: "MONTH" })).toBe(true);
  });
});

describe("toggleKind", () => {
  it("adds a kind", () => {
    expect(toggleKind({ filters: ALL, kind: "finance" })).toEqual({
      kinds: ["finance"],
      range: "ANY",
    });
  });

  it("removes a kind", () => {
    expect(
      toggleKind({ filters: { kinds: ["task", "finance"], range: "ANY" }, kind: "task" }),
    ).toEqual({ kinds: ["finance"], range: "ANY" });
  });

  it("keeps the canonical order regardless of click order", () => {
    let filters: SearchFilters = ALL;
    filters = toggleKind({ filters, kind: "chore" });
    filters = toggleKind({ filters, kind: "task" });
    filters = toggleKind({ filters, kind: "event" });

    expect(filters.kinds).toEqual(["task", "event", "chore"]);
  });

  it("preserves the range", () => {
    expect(
      toggleKind({ filters: { kinds: [], range: "YEAR" }, kind: "task" }),
    ).toEqual({ kinds: ["task"], range: "YEAR" });
  });
});
