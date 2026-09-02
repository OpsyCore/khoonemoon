"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  ShoppingCart,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type Item = {
  id: string;
  list_id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  note: string | null;
  is_checked: boolean;
};

type List = {
  id: string;
  name: string;
  is_active: boolean;
  shopping_items?: Item[] | null;
};

type ListsResponse = {
  lists?: List[];
  message?: string;
  detail?: string;
};

function itemQuantity(item: Item) {
  if (item.quantity == null) return "";
  const value = Number(item.quantity);
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

export function ShoppingManager() {
  const router = useRouter();

  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemQuantityValue, setItemQuantityValue] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemNote, setItemNote] = useState("");

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");
  const [editItemUnit, setEditItemUnit] = useState("");
  const [editItemNote, setEditItemNote] = useState("");

  const fetchLists = useCallback(async () => {
    const response = await fetch("/api/shopping/lists", {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as ListsResponse;

    if (!response.ok) {
      throw new Error(
        data.detail
          ? `${data.message || "دریافت لیست‌های خرید ناموفق بود."} — ${data.detail}`
          : data.message || "دریافت لیست‌های خرید ناموفق بود.",
      );
    }

    return data.lists ?? [];
  }, []);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setLists(await fetchLists());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "دریافت لیست‌های خرید ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchLists]);

  useEffect(() => {
    let cancelled = false;

    void fetchLists()
      .then((nextLists) => {
        if (cancelled) return;
        setLists(nextLists);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "دریافت لیست‌های خرید ناموفق بود.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchLists]);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function resetItemForm() {
    setAddingTo(null);
    setItemName("");
    setItemQuantityValue("");
    setItemUnit("");
    setItemNote("");
  }

  async function createList(event: React.FormEvent) {
    event.preventDefault();

    const name = newListName.trim();
    if (!name) {
      setError("نام لیست را وارد کنید.");
      return;
    }

    clearMessages();
    setBusyKey("new-list");

    try {
      const response = await fetch("/api/shopping/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "ساخت لیست خرید ناموفق بود.");
      }

      setNewListName("");
      setShowNewList(false);
      setSuccess("لیست خرید ساخته شد.");

      if (data.list?.id) {
        setExpanded((current) => ({
          ...current,
          [data.list.id]: true,
        }));
      }

      await loadLists();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخت لیست خرید ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function renameList(listId: string) {
    const name = editingListName.trim();
    if (!name) {
      setError("نام لیست نمی‌تواند خالی باشد.");
      return;
    }

    clearMessages();
    setBusyKey(`list:${listId}`);

    try {
      const response = await fetch(`/api/shopping/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "تغییر نام لیست ناموفق بود.");
      }

      setEditingListId(null);
      setEditingListName("");
      setSuccess("نام لیست تغییر کرد.");
      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تغییر نام لیست ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteList(list: List) {
    const confirmed = window.confirm(
      `لیست «${list.name}» حذف شود؟ آیتم‌های آن از لیست‌های فعال پنهان می‌شوند.`,
    );
    if (!confirmed) return;

    clearMessages();
    setBusyKey(`list:${list.id}`);

    try {
      const response = await fetch(`/api/shopping/lists/${list.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "حذف لیست خرید ناموفق بود.");
      }

      setSuccess("لیست خرید حذف شد.");
      await loadLists();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف لیست خرید ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function addItem(event: React.FormEvent, listId: string) {
    event.preventDefault();

    const name = itemName.trim();
    if (!name) {
      setError("نام کالا را وارد کنید.");
      return;
    }

    const quantity = itemQuantityValue.trim()
      ? Number(itemQuantityValue)
      : null;

    if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError("تعداد باید یک عدد مثبت باشد.");
      return;
    }

    clearMessages();
    setBusyKey(`add:${listId}`);

    try {
      const response = await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId,
          name,
          quantity,
          unit: itemUnit.trim() || null,
          note: itemNote.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "افزودن کالا ناموفق بود.");
      }

      resetItemForm();
      setExpanded((current) => ({ ...current, [listId]: true }));
      setSuccess("کالا به لیست اضافه شد.");
      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "افزودن کالا ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function setChecked(item: Item, checked: boolean) {
    clearMessages();
    setBusyKey(`item:${item.id}`);

    try {
      const response = await fetch(`/api/shopping/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked: checked }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "تغییر وضعیت کالا ناموفق بود.");
      }

      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تغییر وضعیت کالا ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  function startEditItem(item: Item) {
    clearMessages();
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemQuantity(itemQuantity(item));
    setEditItemUnit(item.unit ?? "");
    setEditItemNote(item.note ?? "");
  }

  async function saveItem(itemId: string) {
    const name = editItemName.trim();
    if (!name) {
      setError("نام کالا نمی‌تواند خالی باشد.");
      return;
    }

    const quantity = editItemQuantity.trim() ? Number(editItemQuantity) : null;

    if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError("تعداد باید یک عدد مثبت باشد.");
      return;
    }

    clearMessages();
    setBusyKey(`item:${itemId}`);

    try {
      const response = await fetch(`/api/shopping/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity,
          unit: editItemUnit.trim() || null,
          note: editItemNote.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "ویرایش کالا ناموفق بود.");
      }

      setEditingItemId(null);
      setSuccess("کالا ویرایش شد.");
      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ویرایش کالا ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteItem(item: Item) {
    if (!window.confirm(`«${item.name}» از لیست حذف شود؟`)) return;

    clearMessages();
    setBusyKey(`item:${item.id}`);

    try {
      const response = await fetch(`/api/shopping/items/${item.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "حذف کالا ناموفق بود.");
      }

      setSuccess("کالا حذف شد.");
      await loadLists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف کالا ناموفق بود.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="لیست‌ها"
        subtitle="لیست‌های مشترک خانه؛ بنویسید، تیک بزنید و با هم خرید کنید."
        action={
          <Button
            size="sm"
            type="button"
            onClick={() => {
              clearMessages();
              setShowNewList((current) => !current);
            }}
          >
            <Plus className="size-4" strokeWidth={2} />
            لیست جدید
          </Button>
        }
      />

      {error ? (
        <p className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-field border border-olive/50 bg-olive-soft px-3 py-2 text-sm text-olive-ink">
          {success}
        </p>
      ) : null}

      {showNewList ? (
        <Card id="quick-add-shopping" className="space-y-3">
          <CardTitle>لیست خرید جدید</CardTitle>
          <form
            onSubmit={createList}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="مثلاً خرید هفتگی"
              maxLength={120}
              autoFocus
              className="sm:min-w-72"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busyKey === "new-list"}
                className="flex-1"
              >
                {busyKey === "new-list" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                ساخت
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewList(false)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          در حال دریافت لیست‌های خرید...
        </Card>
      ) : lists.length === 0 ? (
        <EmptyState
          title="هنوز لیست خریدی ندارید"
          description="یک لیست مثل «خرید هفتگی» بسازید و کالاها را با هم اضافه کنید."
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => setShowNewList(true)}
            >
              <Plus className="size-4" strokeWidth={2} />
              ساخت اولین لیست
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {lists.map((list) => {
            const items = list.shopping_items ?? [];
            const open = expanded[list.id] ?? true;
            const remaining = items.filter((item) => !item.is_checked).length;
            const completed = items.length - remaining;
            const listBusy = busyKey === `list:${list.id}`;

            return (
              <Card key={list.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive-ink">
                    <ShoppingCart className="size-4" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {editingListId === list.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingListName}
                          onChange={(e) => setEditingListName(e.target.value)}
                          maxLength={120}
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={listBusy}
                          onClick={() => void renameList(list.id)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingListId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle>{list.name}</CardTitle>
                        <CardDescription>
                          {remaining} مورد باقی مانده
                          {completed > 0 ? ` • ${completed} خریداری‌شده` : ""}
                        </CardDescription>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => {
                        setEditingListId(list.id);
                        setEditingListName(list.name);
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                      aria-label="تغییر نام لیست"
                    >
                      <Pencil className="size-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => void deleteList(list)}
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                      aria-label="حذف لیست"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [list.id]: !open,
                        }))
                      }
                      aria-label={open ? "بستن لیست" : "باز کردن لیست"}
                    >
                      {open ? (
                        <ChevronUp className="size-5" />
                      ) : (
                        <ChevronDown className="size-5" />
                      )}
                    </button>
                  </div>
                </div>

                {open ? (
                  <>
                    {addingTo === list.id ? (
                      <form
                        className="space-y-3 rounded-field border border-olive/40 bg-olive-soft/40 p-3.5"
                        onSubmit={(event) => void addItem(event, list.id)}
                      >
                        <Input
                          label="نام کالا"
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="مثلاً شیر"
                          maxLength={180}
                          autoFocus
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="تعداد"
                            type="number"
                            min="0.01"
                            step="any"
                            value={itemQuantityValue}
                            onChange={(e) =>
                              setItemQuantityValue(e.target.value)
                            }
                            placeholder="مثلاً 2"
                          />
                          <Input
                            label="واحد"
                            value={itemUnit}
                            onChange={(e) => setItemUnit(e.target.value)}
                            placeholder="عدد، کیلو..."
                            maxLength={40}
                          />
                        </div>

                        <Input
                          label="یادداشت"
                          value={itemNote}
                          onChange={(e) => setItemNote(e.target.value)}
                          placeholder="اختیاری"
                          maxLength={1000}
                        />

                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={busyKey === `add:${list.id}`}
                          >
                            {busyKey === `add:${list.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Plus className="size-4" />
                            )}
                            اضافه کن
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={resetItemForm}
                          >
                            انصراف
                          </Button>
                        </div>
                      </form>
                    ) : null}

                    {items.length === 0 ? (
                      <p className="rounded-field border border-dashed border-line-strong/70 px-3 py-4 text-center text-[13px] text-muted">
                        این لیست هنوز خالی است.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line rounded-field border border-line bg-paper/50">
                        {[...items]
                          .sort(
                            (a, b) =>
                              Number(a.is_checked) - Number(b.is_checked),
                          )
                          .map((item) => {
                            const itemBusy = busyKey === `item:${item.id}`;
                            const editing = editingItemId === item.id;

                            return (
                              <li key={item.id} className="px-3.5 py-3">
                                {editing ? (
                                  <div className="space-y-3">
                                    <Input
                                      label="نام کالا"
                                      value={editItemName}
                                      onChange={(e) =>
                                        setEditItemName(e.target.value)
                                      }
                                      maxLength={180}
                                    />

                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        label="تعداد"
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        value={editItemQuantity}
                                        onChange={(e) =>
                                          setEditItemQuantity(e.target.value)
                                        }
                                      />
                                      <Input
                                        label="واحد"
                                        value={editItemUnit}
                                        onChange={(e) =>
                                          setEditItemUnit(e.target.value)
                                        }
                                        maxLength={40}
                                      />
                                    </div>

                                    <Input
                                      label="یادداشت"
                                      value={editItemNote}
                                      onChange={(e) =>
                                        setEditItemNote(e.target.value)
                                      }
                                      maxLength={1000}
                                    />

                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        type="button"
                                        disabled={itemBusy}
                                        onClick={() => void saveItem(item.id)}
                                      >
                                        <Check className="size-4" />
                                        ذخیره
                                      </Button>
                                      <Button
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setEditingItemId(null)}
                                      >
                                        انصراف
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-3">
                                    <button
                                      type="button"
                                      disabled={itemBusy}
                                      onClick={() =>
                                        void setChecked(item, !item.is_checked)
                                      }
                                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition ${
                                        item.is_checked
                                          ? "border-olive bg-olive text-cream dark:text-[#221c14]"
                                          : "border-line-strong bg-paper text-transparent hover:border-olive hover:text-olive/50"
                                      }`}
                                      aria-label={
                                        item.is_checked
                                          ? "برگرداندن به لیست خرید"
                                          : "خریداری شد"
                                      }
                                    >
                                      {itemBusy ? (
                                        <Loader2 className="size-3.5 animate-spin text-muted" />
                                      ) : (
                                        <Check
                                          className="size-3.5"
                                          strokeWidth={2.5}
                                        />
                                      )}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`text-sm font-medium ${
                                          item.is_checked
                                            ? "text-faint line-through"
                                            : "text-ink "
                                        }`}
                                      >
                                        {item.name}
                                      </p>

                                      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                                        {item.quantity != null ? (
                                          <span>
                                            {itemQuantity(item)}
                                            {item.unit ? ` ${item.unit}` : ""}
                                          </span>
                                        ) : item.unit ? (
                                          <span>{item.unit}</span>
                                        ) : null}

                                        {item.note ? (
                                          <span>{item.note}</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 gap-1">
                                      {item.is_checked ? (
                                        <button
                                          type="button"
                                          disabled={itemBusy}
                                          onClick={() =>
                                            void setChecked(item, false)
                                          }
                                          className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                                          aria-label="برگرداندن"
                                        >
                                          <RotateCcw className="size-4" />
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        disabled={itemBusy}
                                        onClick={() => startEditItem(item)}
                                        className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"
                                        aria-label="ویرایش کالا"
                                      >
                                        <Pencil className="size-4" />
                                      </button>

                                      <button
                                        type="button"
                                        disabled={itemBusy}
                                        onClick={() => void deleteItem(item)}
                                        className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-danger-soft hover:text-danger-ink"
                                        aria-label="حذف کالا"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}

                    {addingTo !== list.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          resetItemForm();
                          setAddingTo(list.id);
                        }}
                        className="flex w-full items-center gap-1.5 px-1 pt-1 text-[13px] font-medium text-olive-ink transition hover:opacity-80"
                      >
                        <Plus className="size-4" strokeWidth={2} />
                        افزودن آیتم
                      </button>
                    ) : null}
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
