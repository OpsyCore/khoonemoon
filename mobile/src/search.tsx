import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  Clock3,
  Database,
  House,
  Search as SearchIcon,
  ShoppingCart,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { searchWorkspaceFiltered } from "@/features/search/direct-client";
import {
  matchParts,
  recentQueries,
  rememberQuery,
  resultStatus,
} from "@/features/search/reference-model";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  RANGE_LABELS,
  parseSearchFilters,
  toggleKind,
  type SearchFilters,
  type SearchKind,
  type SearchResult,
  type TimeRange,
} from "@/features/search/filters";
import { searchUrl } from "./search-url";
import "./search.css";

const labels: Record<SearchKind, string> = {
  task: "تسک‌ها",
  event: "رویدادها",
  shopping_item: "خریدها",
  finance: "مالی",
  chore: "کارهای خانه",
};
const icons = {
  task: CheckSquare,
  event: CalendarDays,
  shopping_item: ShoppingCart,
  finance: Database,
  chore: House,
};
const displayOrder: SearchKind[] = [
  "shopping_item",
  "task",
  "event",
  "finance",
  "chore",
];
function readInitial() {
  const params = new URLSearchParams(window.location.search),
    raw = new URLSearchParams();
  params.getAll("search_kind").forEach((value) => raw.append("kind", value));
  if (params.has("search_range"))
    raw.set("range", params.get("search_range") || "");
  return {
    query: (params.get("search_q") ?? "").slice(0, 100),
    filters: parseSearchFilters(raw),
  };
}
function saveSearch(query: string, filters: SearchFilters) {
  try {
    window.history.replaceState(
      window.history.state,
      "",
      searchUrl(new URL(window.location.href), query, filters),
    );
  } catch {
    /* URL persistence is optional */
  }
}
export function Search({
  client,
  userId,
  onNavigate,
  persistUrl = true,
}: {
  client: SupabaseClient;
  userId: string;
  persistUrl?: boolean;
  onNavigate: (kind: SearchKind) => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState<Partial<Record<SearchKind, number>>>({});
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const historyKey = `khoonemoon:search-history:${userId}`;
  useEffect(() => {
    const initial = readInitial();
    // Hydrate device-only state after SSR; local storage may be unavailable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(initial.query);
    setFilters(initial.filters);
    setSubmitted(initial.query.trim().length >= 2 ? initial.query.trim() : "");
    try {
      setRecent(
        recentQueries(JSON.parse(localStorage.getItem(historyKey) ?? "[]")),
      );
    } catch {
      setRecent([]);
    }
    setReady(true);
  }, [historyKey]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      const value = query.trim();
      setOffset(0);
      setSubmitted(value.length >= 2 ? value : "");
      setError("");
      if (persistUrl) saveSearch(value.length >= 2 ? value : "", filters);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, ready, filters, persistUrl]);
  useEffect(() => {
    if (!submitted) return;
    let alive = true;
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
          setCounts({});
          setTotal(0);
          setError("جستجو ناموفق بود؛ اتصال اینترنت را بررسی کنید.");
          setBusy(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [client, submitted, filters, offset, revision]);
  function remember(q: string) {
    const next = rememberQuery(recent, q);
    setRecent(next);
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {
      /* history remains session-only */
    }
  }
  function execute(value: string) {
    const q = value.trim();
    if (q.length < 2) {
      setError("حداقل دو حرف وارد کنید.");
      return;
    }
    setQuery(q);
    setSubmitted(q);
    setOffset(0);
    setRevision((n) => n + 1);
    setShowSuggestions(false);
    remember(q);
    if (persistUrl) saveSearch(q, filters);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    execute(query);
  }
  function updateFilters(next: SearchFilters) {
    setOffset(0);
    setFilters(next);
    if (persistUrl) saveSearch(submitted, next);
  }
  const current = submitted && submitted === query.trim();
  const suggestions =
    current && !busy && !error
      ? [...new Set(results.map((result) => result.title))].slice(0, 6)
      : [];
  return (
    <section className="search-ref" dir="rtl">
      <header className="search-ref-header">
        <span className="search-ref-branch" aria-hidden="true" />
        <h1>جستجو در خونه‌مون</h1>
        <p>
          می‌تونید در تسک‌ها، رویدادها، خریدها، مطالب مالی
          <br /> و کارهای خانه جستجو کنید.
        </p>
      </header>
      <form className="search-ref-form" onSubmit={submit} role="search">
        <button type="submit" aria-label="جستجو">
          <SearchIcon />
        </button>
        <input
          type="search"
          aria-label="عبارت جستجو"
          maxLength={100}
          value={query}
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          placeholder="جستجو در خونه‌مون"
        />
        <button
          type="button"
          aria-label="پاک کردن جستجو"
          onClick={() => {
            setQuery("");
            setSubmitted("");
            setResults([]);
            setCounts({});
            setTotal(0);
            setError("");
            setShowSuggestions(true);
            if (persistUrl) saveSearch("", filters);
          }}
        >
          <X />
        </button>
      </form>
      {showSuggestions && (suggestions.length > 0 || recent.length > 0) && (
        <div className="search-ref-suggestions">
          {suggestions.length > 0 && (
            <div
              className="search-ref-suggest-grid"
              aria-label="پیشنهادهای حاصل از نتایج"
            >
              <span className="search-ref-suggest-heading">
                پیشنهاد از نتایج قابل دسترس
              </span>
              {suggestions.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => execute(value)}
                >
                  <SearchIcon />
                  {value}
                </button>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="search-ref-recent">
              <div>
                <Clock3 /> جستجوهای اخیر{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRecent([]);
                    try {
                      localStorage.removeItem(historyKey);
                    } catch {
                      /* optional */
                    }
                  }}
                >
                  پاک کردن
                </button>
              </div>
              <div className="search-ref-recent-chips">
                {recent.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => execute(value)}
                  >
                    <Clock3 />
                    {value}
                  </button>
                ))}
              </div>
              <small>فقط روی این دستگاه و برای این حساب ذخیره می‌شود.</small>
            </div>
          )}
        </div>
      )}
      <div
        className="search-ref-kinds"
        role="group"
        aria-label="فیلتر نوع نتیجه"
      >
        <button
          type="button"
          aria-pressed={filters.kinds.length === 0}
          onClick={() => updateFilters({ ...filters, kinds: [] })}
        >
          همه
        </button>
        {ALL_KINDS.map((kind) => {
          const Icon = icons[kind];
          return (
            <button
              type="button"
              key={kind}
              aria-pressed={filters.kinds.includes(kind)}
              onClick={() => updateFilters(toggleKind({ filters, kind }))}
            >
              <Icon />
              {labels[kind]}
            </button>
          );
        })}
      </div>
      <div className="search-ref-ranges" role="group" aria-label="بازه زمانی">
        {(["WEEK", "MONTH", "YEAR", "ANY"] as TimeRange[]).map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={filters.range === range}
            onClick={() => updateFilters({ ...filters, range })}
          >
            {RANGE_LABELS[range]}
          </button>
        ))}
      </div>
      {busy && current && <p role="status">در حال جستجو…</p>}
      {error && (current || query.trim().length < 2) && (
        <p className="search-ref-error" role="alert">
          {error}
        </p>
      )}
      {current && !busy && !error && (
        <>
          <h2 className="search-ref-results-heading">
            نتایج جستجو ({total.toLocaleString("fa-IR")})
          </h2>
          {results.length === 0 ? (
            <div className="search-ref-empty">
              <span aria-hidden="true" />
              <h2>نتیجه‌ای یافت نشد</h2>
              <p>عبارت دیگری را امتحان کنید یا فیلترها را تغییر دهید.</p>
            </div>
          ) : (
            <div className="search-ref-groups">
              {displayOrder.map((kind) => {
                const group = results.filter((item) => item.kind === kind);
                if (!group.length) return null;
                const Icon = icons[kind];
                return (
                  <details className="search-ref-group" open key={kind}>
                    <summary>
                      <Icon />
                      {labels[kind]}{" "}
                      <span>
                        (
                        {(counts[kind] ?? group.length).toLocaleString("fa-IR")}
                        )
                      </span>
                    </summary>
                    <div className="search-ref-cards">
                      {group.map((item) => {
                        const parts = matchParts(item.title, submitted),
                          status = resultStatus(kind, item.status),
                          date = item.happened_at
                            ? new Date(item.happened_at)
                            : null;
                        return (
                          <details
                            className="search-ref-result"
                            key={item.entity_id}
                          >
                            <summary>
                              <span className="search-ref-result-icon">
                                <Icon />
                              </span>
                              <span className="search-ref-result-text">
                                <strong>
                                  {parts ? (
                                    <>
                                      {parts.before}
                                      <mark>{parts.match}</mark>
                                      {parts.after}
                                    </>
                                  ) : (
                                    item.title
                                  )}
                                </strong>
                                {item.subtitle && <span>{item.subtitle}</span>}
                                {date && !Number.isNaN(date.getTime()) && (
                                  <small>
                                    <CalendarDays />
                                    {new Intl.DateTimeFormat("fa-IR", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                    }).format(date)}
                                  </small>
                                )}
                              </span>
                              {status && (
                                <span
                                  className={`search-ref-status status-${item.status?.toLowerCase()}`}
                                >
                                  {status}
                                </span>
                              )}
                              <ChevronLeft className="search-ref-chevron" />
                            </summary>
                            <div className="search-ref-result-detail">
                              <p>
                                برای مشاهده و مدیریت، بخش مربوط را باز کنید.
                              </p>
                              <button
                                type="button"
                                onClick={() => onNavigate(kind)}
                              >
                                رفتن به بخش {labels[kind]}
                              </button>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          {total > 50 && (
            <p className="search-ref-page-note">
              شمارش هر دسته مربوط به همه نتایج آن است؛ هر صفحه حداکثر ۵۰ مورد
              نمایش می‌دهد.
            </p>
          )}
          {total > 50 && (
            <div className="search-ref-pagination">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                صفحه قبل
              </button>
              <span>
                صفحه {(Math.floor(offset / 50) + 1).toLocaleString("fa-IR")}
              </span>
              <button
                type="button"
                disabled={offset + 50 >= total || offset >= 10000}
                onClick={() => setOffset(offset + 50)}
              >
                صفحه بعد
              </button>
            </div>
          )}
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
