"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";

type SearchResult = {
  kind: "task" | "event" | "shopping_item" | "finance" | "chore";
  entity_id: string;
  title: string;
  subtitle: string | null;
  happened_at: string | null;
  status: string | null;
};

const KIND_LABELS: Record<SearchResult["kind"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  task: { label: "تسک", tone: "neutral" },
  event: { label: "رویداد", tone: "warning" },
  shopping_item: { label: "خرید", tone: "success" },
  finance: { label: "مالی", tone: "danger" },
  chore: { label: "کار خانه", tone: "neutral" },
};

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          در حال جستجو...
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
      ) : null}

      {!isLoading && trimmedQuery.length >= 2 && results.length === 0 ? (
        <EmptyState
          title="نتیجه‌ای پیدا نشد"
          description="عبارت دیگری را امتحان کنید. جستجو فقط داده‌هایی را نشان می‌دهد که مجاز به دیدنشان هستید."
        />
      ) : null}

      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((result) => {
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
