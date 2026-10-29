"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  RANGE_LABELS,
  countByKind,
  filterResults,
  hasActiveFilters,
  toggleKind,
  type SearchFilters,
  type SearchKind,
  type SearchResult,
  type TimeRange,
} from "@/features/search/filters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { toPersianNumber } from "@/shared/utils/locale";

const KIND_LABELS: Record<
  SearchKind,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  task: { label: "تسک", tone: "neutral" },
  event: { label: "رویداد", tone: "warning" },
  shopping_item: { label: "خرید", tone: "success" },
  finance: { label: "مالی", tone: "danger" },
  chore: { label: "کار خانه", tone: "neutral" },
};

const RANGES: TimeRange[] = ["ANY", "WEEK", "MONTH", "YEAR"];

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setErrorMessage("جستجو ناموفق بود.");
          return;
        }

        const payload = (await response.json()) as { results: SearchResult[] };
        setResults(payload.results);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage("جستجو ناموفق بود.");
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const now = new Date();
  const visible = filterResults({ results, filters, now });
  const counts = countByKind({ results, filters, now });
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-zinc-400" />
        <Input
          aria-label="جستجو"
          className="pr-9"
          placeholder="جستجو در تسک‌ها، خرید، قبض‌ها و کارهای خانه"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 2) {
              setResults([]);
              setErrorMessage(null);
            }
          }}
        />
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="فیلتر نوع نتیجه"
          >
            {ALL_KINDS.map((kind) => {
              const isActive = filters.kinds.includes(kind);
              const count = counts[kind];

              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={isActive}
                  disabled={count === 0 && !isActive}
                  onClick={() =>
                    setFilters((current) =>
                      toggleKind({ filters: current, kind }),
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                    isActive
                      ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {KIND_LABELS[kind].label} ({toPersianNumber(count)})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              بازه:
            </span>
            {RANGES.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={filters.range === range ? "secondary" : "ghost"}
                aria-pressed={filters.range === range}
                onClick={() => setFilters((current) => ({ ...current, range }))}
              >
                {RANGE_LABELS[range]}
              </Button>
            ))}

            {isFiltered ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                <X className="size-3" />
                پاک‌کردن فیلترها
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isFiltered
              ? `${toPersianNumber(visible.length)} از ${toPersianNumber(
                  results.length,
                )} نتیجه با فیلترهای فعلی`
              : `${toPersianNumber(results.length)} نتیجه`}
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          در حال جستجو...
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && trimmedQuery.length >= 2 && results.length === 0 ? (
        <EmptyState
          title="نتیجه‌ای پیدا نشد"
          description="عبارت دیگری را امتحان کنید. جستجو فقط داده‌هایی را نشان می‌دهد که مجاز به دیدنشان هستید."
        />
      ) : null}

      {results.length > 0 && visible.length === 0 ? (
        <EmptyState
          title="با این فیلترها چیزی نیست"
          description="فیلترها را پاک کنید یا بازهٔ زمانی را بازتر کنید تا بقیهٔ نتایج دیده شوند."
        />
      ) : null}

      {visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((result) => {
            const kind = KIND_LABELS[result.kind];

            return (
              <li key={`${result.kind}-${result.entity_id}`}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {result.title}
                    </p>
                    {result.subtitle ? (
                      <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {result.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={kind.tone}>{kind.label}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
