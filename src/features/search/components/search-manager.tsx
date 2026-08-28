"use client";

import {
  CalendarDays,
  CircleCheckBig,
  House,
  Loader2,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SEARCH_TYPE_LABELS,
  type SearchEntityType,
  type SearchResponse,
  type SearchResult,
} from "@/features/search/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { Input } from "@/shared/ui/input";

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

export function SearchManager() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
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
        setLoading(false);
        setErrorMessage(null);
        setResponse(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(() => {
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
          setResponse(null);
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
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          جستجو
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          بین تسک‌ها، کارهای خانه، خرید، رویدادها و مالی جستجو کنید.
        </p>
      </section>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id="global-search"
            name="q"
            label="جستجو"
            value={draft}
            autoFocus
            autoComplete="off"
            placeholder="مثلاً نان، قبض برق، خرید هفتگی"
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        {draft ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 shrink-0 px-0"
            aria-label="پاک کردن جستجو"
            onClick={() => {
              setDraft("");
              setQuery("");
            }}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-zinc-500">
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

      {query && !loading && !errorMessage && response && response.total === 0 ? (
        <EmptyState
          title="چیزی پیدا نشد"
          description={`نتیجه‌ای برای «${query}» پیدا نشد.`}
        />
      ) : null}

      {query && !loading && !errorMessage && groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.type} className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {SEARCH_TYPE_LABELS[group.type]}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  return (
                    <li key={`${item.type}:${item.id}`}>
                      <Link href={item.href} className="block min-w-0">
                        <Card className="flex min-w-0 items-start gap-3 transition hover:border-sky-300 dark:hover:border-sky-800">
                          <Icon className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <CardTitle>{item.title}</CardTitle>
                              <Badge tone="neutral">
                                {SEARCH_TYPE_LABELS[item.type]}
                              </Badge>
                            </div>
                            {item.snippet ? (
                              <CardDescription>{item.snippet}</CardDescription>
                            ) : null}
                          </div>
                        </Card>
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
