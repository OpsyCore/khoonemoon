import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { searchWorkspace } from "@/features/search/direct-client";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  RANGE_LABELS,
  filterResults,
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
export function Search({ client }: { client: SupabaseClient }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ query: string } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!submitted) return;
    let alive = true;
    void searchWorkspace(client, submitted.query)
      .then((rows) => {
        if (alive) {
          setResults(rows);
          setBusy(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError("جستجو ناموفق بود؛ اتصال اینترنت را بررسی کنید.");
          setBusy(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [client, submitted]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    setResults([]);
    setError("");
    if (q.length < 2) {
      setSubmitted(null);
      setBusy(false);
      setError("حداقل دو حرف وارد کنید.");
      return;
    }
    setBusy(true);
    setSubmitted({ query: q });
  }
  const visible = filterResults({ results, filters, now: new Date() });
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
            onClick={() =>
              setFilters((current) => toggleKind({ filters: current, kind }))
            }
          >
            {labels[kind]}
          </button>
        ))}
      </div>
      <label>
        بازه زمانی
        <select
          value={filters.range}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              range: e.target.value as TimeRange,
            }))
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
          <p>
            حداکثر ۵۰ نتیجهٔ مجاز نمایش داده می‌شود؛ فیلترها روی همین نتایج
            اعمال می‌شوند.
          </p>
          {visible.length === 0 ? (
            <p>نتیجه‌ای پیدا نشد.</p>
          ) : (
            <ul>
              {visible.map((item) => (
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
        </>
      )}
    </section>
  );
}
