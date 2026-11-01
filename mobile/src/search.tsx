import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { searchWorkspaceFiltered } from "@/features/search/direct-client";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  RANGE_LABELS,
  hasActiveFilters,
  parseSearchFilters,
  toggleKind,
  type SearchFilters,
  type SearchKind,
  type SearchResult,
  type TimeRange,
} from "@/features/search/filters";

const labels: Record<SearchKind, string> = {
  task: "کار",
  event: "رویداد",
  shopping_item: "خرید",
  finance: "مالی",
  chore: "کار خانه",
};
function initial() {
  const params = new URLSearchParams(window.location.search);
  const raw = new URLSearchParams();
  params.getAll("search_kind").forEach((value) => raw.append("kind", value));
  if (params.has("search_range"))
    raw.set("range", params.get("search_range") || "");
  return {
    query: (params.get("search_q") ?? "").slice(0, 100),
    filters: parseSearchFilters(raw),
  };
}
function saveSearch(query: string, filters: SearchFilters) {
  const url = new URL(window.location.href);
  url.searchParams.delete("search_q");
  url.searchParams.delete("search_kind");
  url.searchParams.delete("search_range");
  if (query) url.searchParams.set("search_q", query);
  filters.kinds.forEach((kind) => url.searchParams.append("search_kind", kind));
  if (filters.range !== "ANY")
    url.searchParams.set("search_range", filters.range);
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* URL persistence is optional */
  }
}
export function Search({ client }: { client: SupabaseClient }) {
  const [initialState] = useState(initial);
  const [query, setQuery] = useState(initialState.query);
  const [submitted, setSubmitted] = useState(
    initialState.query.length >= 2 ? initialState.query : "",
  );
  const [filters, setFilters] = useState<SearchFilters>(
    initialState.filters ?? DEFAULT_FILTERS,
  );
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState<Partial<Record<SearchKind, number>>>({});
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!submitted) return;
    let alive = true;
    // Request cancellation guard prevents stale filter responses replacing new ones.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    void searchWorkspaceFiltered(client, submitted, filters, new Date(), offset)
      .then((result) => {
        if (!alive) return;
        setResults(result.results);
        setCounts(result.counts);
        setTotal(result.total);
        setBusy(false);
      })
      .catch(() => {
        if (alive) {
          setResults([]);
          setError("جستجو ناموفق بود؛ اتصال اینترنت را بررسی کنید.");
          setBusy(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [client, submitted, filters, offset, revision]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setSubmitted("");
      setError("حداقل دو حرف وارد کنید.");
      return;
    }
    setOffset(0);
    setSubmitted(q);
    setRevision((value) => value + 1);
    saveSearch(q, filters);
  }
  function updateFilters(next: SearchFilters) {
    setOffset(0);
    setFilters(next);
    saveSearch(submitted, next);
  }
  return (
    <section>
      <h2>جستجو</h2>
      <form onSubmit={submit}>
        <label>
          عبارت جستجو
          <input
            type="search"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در کارها، خرید و مالی"
          />
        </label>
        <button disabled={busy}>جستجو</button>
      </form>
      <div className="search-filters" aria-label="نوع نتیجه">
        {ALL_KINDS.map((kind) => (
          <button
            type="button"
            className="minor"
            aria-pressed={filters.kinds.includes(kind)}
            key={kind}
            onClick={() => updateFilters(toggleKind({ filters, kind }))}
          >
            {labels[kind]} ({counts[kind] ?? 0})
          </button>
        ))}
      </div>
      <label>
        بازه زمانی
        <select
          value={filters.range}
          onChange={(e) =>
            updateFilters({ ...filters, range: e.target.value as TimeRange })
          }
        >
          {Object.entries(RANGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {busy && <p role="status">در حال جستجو…</p>}
      {error && <p role="alert">{error}</p>}
      {submitted && !busy && !error && (
        <>
          <p>{total} نتیجه؛ هر صفحه حداکثر ۵۰ مورد.</p>
          {results.length === 0 ? (
            <p>
              {hasActiveFilters(filters)
                ? "نتیجه‌ای با فیلترهای انتخابی پیدا نشد."
                : "نتیجه‌ای پیدا نشد."}
            </p>
          ) : (
            <ul>
              {results.map((item) => (
                <li key={`${item.kind}:${item.entity_id}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {labels[item.kind]}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button
              className="minor"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              صفحه قبل
            </button>
            <button
              className="minor"
              disabled={offset + 50 >= total || offset >= 10000}
              onClick={() => setOffset(offset + 50)}
            >
              صفحه بعد
            </button>
          </div>
          {total > 10050 && (
            <p>
              نمایش به ۱۰٬۰۵۰ نتیجه محدود است؛ عبارت یا فیلتر را دقیق‌تر کنید.
            </p>
          )}
        </>
      )}
    </section>
  );
}
