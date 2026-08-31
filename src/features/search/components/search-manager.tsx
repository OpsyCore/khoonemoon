"use client";

import {
  CalendarDays,
  ChevronLeft,
  CircleCheckBig,
  House,
  Loader2,
  Search,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { applySearchQueryToPath } from "@/features/search/query";
import {
  SEARCH_TYPE_LABELS,
  type SearchEntityType,
  type SearchResponse,
  type SearchResult,
} from "@/features/search/types";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { offlineUserMessage } from "@/shared/offline/online-status";
import { ErrorState } from "@/shared/ui/error-state";
import { Input } from "@/shared/ui/input";
import { SectionLabel } from "@/shared/ui/section-label";

const TYPE_ICONS: Record<SearchEntityType, typeof CircleCheckBig> = {
  task: CircleCheckBig,
  chore: House,
  shopping_list: ShoppingCart,
  shopping_item: ShoppingCart,
  event: CalendarDays,
  finance: Wallet,
};

function groupResults(results: SearchResult[]) {
  const groups: Array<{ type: SearchEntityType; items: SearchResult[] }> = [];
  for (const item of results) {
    const current = groups.find((group) => group.type === item.type);
    if (current) {
      current.items.push(item);
    } else {
      groups.push({ type: item.type, items: [item] });
    }
  }
  return groups;
}

export function SearchManager({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(draft.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    abortRef.current?.abort();

    if (!query) {
      const resetTimer = window.setTimeout(() => {
        const nextPath = applySearchQueryToPath({
          pathname: window.location.pathname,
          search: window.location.search,
          query: "",
        });
        const currentPath = `${window.location.pathname}${window.location.search}`;
        if (currentPath !== nextPath) {
          window.history.replaceState(null, "", nextPath);
        }
        setLoading(false);
        setErrorMessage(null);
        setResponse(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(() => {
      const nextPath = applySearchQueryToPath({
        pathname: window.location.pathname,
        search: window.location.search,
        query,
      });
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath !== nextPath) {
        window.history.replaceState(null, "", nextPath);
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setLoading(false);
        setErrorMessage(offlineUserMessage());
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      void (async () => {
        try {
          const result = await fetch(
            `/api/search?q=${encodeURIComponent(query)}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );
          const data = (await result.json()) as SearchResponse & {
            message?: string;
          };
          if (!result.ok) {
            throw new Error(data.message || "جستجو ناموفق بود.");
          }
          setResponse({
            query: data.query,
            results: data.results ?? [],
            total: data.total ?? 0,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          setErrorMessage(
            error instanceof Error ? error.message : "جستجو ناموفق بود.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const groups = useMemo(
    () => groupResults(response?.results ?? []),
    [response],
  );

  function retry() {
    const current = draft.trim();
    setQuery("");
    window.setTimeout(() => setQuery(current), 0);
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
        />
        <Input
          id="global-search"
          name="q"
          value={draft}
          autoFocus
          autoComplete="off"
          placeholder="مثلاً نان، قبض برق، خرید هفتگی"
          onChange={(event) => setDraft(event.target.value)}
          className="h-12 rounded-full border-line-strong bg-card pr-11 shadow-paper"
        />
        {draft ? (
          <button
            type="button"
            aria-label="پاک کردن جستجو"
            onClick={() => {
              setDraft("");
              setQuery("");
            }}
            className="absolute left-2.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          در حال جستجو...
        </Card>
      ) : null}

      {errorMessage ? (
        <ErrorState
          title="جستجو انجام نشد"
          description={errorMessage}
          onRetry={retry}
        />
      ) : null}

      {!query && !loading && !errorMessage ? (
        <EmptyState
          title="چیزی را جستجو کنید"
          description="عنوان تسک، کار خانه، لیست خرید، رویداد یا مورد مالی را بنویسید."
        />
      ) : null}

      {query &&
      !loading &&
      !errorMessage &&
      response &&
      response.total === 0 ? (
        <EmptyState
          title="چیزی پیدا نشد"
          description={`نتیجه‌ای برای «${query}» پیدا نشد.`}
        />
      ) : null}

      {query && !loading && !errorMessage && groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.type} className="space-y-3">
              <SectionLabel>{SEARCH_TYPE_LABELS[group.type]}</SectionLabel>
              <ul className="divide-y divide-line rounded-card border border-line bg-card shadow-paper">
                {group.items.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  return (
                    <li key={`${item.type}:${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex min-w-0 items-start gap-3 px-4 py-3.5 transition hover:bg-sunken/50"
                      >
                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive-ink">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">
                            {item.title}
                          </p>
                          {item.snippet ? (
                            <p className="mt-0.5 text-[12px] leading-5 text-muted">
                              {item.snippet}
                            </p>
                          ) : null}
                        </div>
                        <ChevronLeft
                          className="mt-1 size-4 shrink-0 text-faint"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
