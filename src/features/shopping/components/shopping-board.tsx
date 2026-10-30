"use client";

import {
  Check,
  Plus,
  ShoppingBasket,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  compareItems,
  mergeShoppingItems,
  removeShoppingItem,
  type ShoppingItem,
  type ShoppingList,
} from "@/features/shopping/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";

export function ShoppingBoard({
  lists,
  initialItems,
  initialListId,
}: {
  lists: ShoppingList[];
  initialItems: ShoppingItem[];
  initialListId: string | null;
}) {
  const router = useRouter();
  const [activeListId, setActiveListId] = useState<string | null>(
    initialListId ?? lists[0]?.id ?? null,
  );
  const [newListName, setNewListName] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [newItemName, setNewItemName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeListIdRef = useRef(activeListId);
  const requestSequence = useRef(0);
  const [showNewList, setShowNewList] = useState(false);

  const loadItems = useCallback(async (listId: string) => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch(
        `/api/shopping/items?listId=${encodeURIComponent(listId)}`,
      );
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as { items: ShoppingItem[] };
      if (
        sequence === requestSequence.current &&
        activeListIdRef.current === listId
      ) {
        setItems(payload.items);
      }
    } catch {
      if (sequence === requestSequence.current)
        setErrorMessage("دریافت آیتم‌های لیست ناموفق بود.");
    }
  }, []);

  const selectList = async (listId: string) => {
    activeListIdRef.current = listId;
    setActiveListId(listId);
    setItems([]);
    setErrorMessage(null);
    await loadItems(listId);
  };

  // Realtime: both partners see item changes without refreshing.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("shopping-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as { id?: string };
            if (!removed.id) return;
            setItems((current) => removeShoppingItem(current, removed.id!));
            return;
          }

          const incoming = payload.new as ShoppingItem;
          if (!incoming?.id) return;
          if (incoming.list_id !== activeListIdRef.current) return;

          setItems((current) => mergeShoppingItems(current, incoming));
        },
      )
      .subscribe((status) => {
        setIsSyncing(status !== "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const togglePurchased = async (item: ShoppingItem) => {
    setErrorMessage(null);

    const optimistic = {
      ...item,
      purchased: !item.purchased,
      purchased_at: !item.purchased ? new Date().toISOString() : null,
    };

    setItems((current) =>
      [...current]
        .map((entry) => (entry.id === item.id ? optimistic : entry))
        .sort(compareItems),
    );

    const response = await fetch(`/api/shopping/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchased: !item.purchased }),
    });

    if (!response.ok) {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? item : entry)),
      );
      setErrorMessage("تغییر وضعیت آیتم ناموفق بود.");
    }
  };

  const addItem = async () => {
    const name = newItemName.trim();
    if (!name || !activeListId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/api/shopping/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: activeListId, name }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setErrorMessage(payload?.message ?? "افزودن آیتم ناموفق بود.");
      return;
    }

    const payload = (await response.json()) as { item: ShoppingItem };
    setNewItemName("");
    setItems((current) => mergeShoppingItems(current, payload.item));
  };

  const deleteItem = async (item: ShoppingItem) => {
    setErrorMessage(null);
    setItems((current) => removeShoppingItem(current, item.id));

    const response = await fetch(`/api/shopping/items/${item.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setErrorMessage("حذف آیتم ناموفق بود.");
      void loadItems(item.list_id);
    }
  };

  const stats = useMemo(() => {
    const purchased = items.filter((item) => item.purchased).length;
    return { purchased, remaining: items.length - purchased };
  }, [items]);

  const createList = async () => {
    const name = newListName.trim();
    if (name.length < 2) {
      setErrorMessage("نام لیست را وارد کنید.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/api/shopping/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setErrorMessage(payload?.message ?? "ایجاد لیست خرید ناموفق بود.");
      return;
    }

    const payload = (await response.json()) as { list: ShoppingList };
    setNewListName("");
    requestSequence.current += 1;
    activeListIdRef.current = payload.list.id;
    setActiveListId(payload.list.id);
    setItems([]);
    setShowNewList(false);
    router.refresh();
  };

  if (!activeListId) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="size-4 text-olive-ink" />
          <CardTitle>اولین لیست خرید</CardTitle>
        </div>
        <CardDescription>
          یک لیست بسازید تا هر دو نفر بتوانید آیتم‌ها را هم‌زمان اضافه کنید.
        </CardDescription>
        <div className="flex gap-2">
          <Input
            aria-label="نام لیست"
            placeholder="مثلاً: خرید هفتگی"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
          />
          <Button onClick={() => void createList()} isLoading={isSubmitting}>
            <Plus className="size-4" />
            ساخت
          </Button>
        </div>
        {errorMessage ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="size-4 text-olive-ink" />
            <CardTitle>خرید مشترک</CardTitle>
          </div>
          <Badge tone={isSyncing ? "warning" : "success"}>
            <span className="flex items-center gap-1">
              {isSyncing ? (
                <WifiOff className="size-3" />
              ) : (
                <Wifi className="size-3" />
              )}
              {isSyncing ? "در حال هم‌زمان‌سازی" : "هم‌زمان زنده"}
            </span>
          </Badge>
        </div>

        <CardDescription>
          {stats.remaining} مورد باقی‌مانده · {stats.purchased} مورد خریداری شده
        </CardDescription>

        {lists.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <Button
                key={list.id}
                size="sm"
                variant={list.id === activeListId ? "secondary" : "ghost"}
                onClick={() => void selectList(list.id)}
              >
                {list.name}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="border-t border-line pt-3">
          {showNewList ? (
            <div className="flex gap-2">
              <Input
                aria-label="نام لیست جدید"
                placeholder="نام لیست جدید"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
              />
              <Button
                onClick={() => void createList()}
                isLoading={isSubmitting}
              >
                ساخت
              </Button>
              <Button variant="ghost" onClick={() => setShowNewList(false)}>
                انصراف
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewList(true)}
            >
              <Plus className="size-4" /> لیست جدید
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="نام آیتم جدید"
            placeholder="مثلاً: شیر"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addItem();
              }
            }}
          />
          <Button onClick={() => void addItem()} isLoading={isSubmitting}>
            <Plus className="size-4" />
            افزودن
          </Button>
        </div>

        {errorMessage ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        ) : null}
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="لیست خالی است"
          description="اولین قلم را اضافه کنید تا شریک‌تان هم بلافاصله ببیند."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => void togglePurchased(item)}
                  className="flex flex-1 items-center gap-3 text-right"
                  aria-pressed={item.purchased}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      item.purchased
                        ? "border-olive bg-olive text-cream"
                        : "border-line-strong"
                    }`}
                  >
                    {item.purchased ? <Check className="size-4" /> : null}
                  </span>
                  <span
                    className={`text-sm ${
                      item.purchased ? "text-faint line-through" : "text-ink"
                    }`}
                  >
                    {item.name}
                    {item.quantity ? (
                      <span className="text-xs text-muted">
                        {" "}
                        — {Number(item.quantity)}
                        {item.unit ? ` ${item.unit}` : ""}
                      </span>
                    ) : null}
                  </span>
                </button>

                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`حذف ${item.name}`}
                  onClick={() => void deleteItem(item)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
