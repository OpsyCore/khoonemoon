import {
  Apple,
  House,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingBasket,
  SprayCan,
  X,
} from "lucide-react";
import "./shopping.css";
import { reloadAfterSave } from "./after-save";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directShopping } from "@/features/shopping/direct-client";
import type { ShoppingItem, ShoppingList } from "@/features/shopping/types";
import { parseAmount } from "@/shared/utils/amount";

export function Shopping({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string;
}) {
  const api = useMemo(() => directShopping(client), [client]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [listName, setListName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState("همه");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState("برای دریافت تغییرات تازه‌سازی کنید.");
  const pendingPurchase = useRef<{ id: string; value: boolean } | null>(null);
  const itemFetchSequence = useRef(0);
  const readItems = useCallback(
    async (listId: string) => {
      const seq = ++itemFetchSequence.current;
      const rows = await api.items(listId);
      if (seq !== itemFetchSequence.current) return;
      const pending = pendingPurchase.current;
      setItems(
        pending
          ? rows.map((row) =>
              row.id === pending.id
                ? { ...row, purchased: pending.value }
                : row,
            )
          : rows,
      );
    },
    [api],
  );
  const refreshLists = useCallback(async () => {
    const data = await api.lists(householdId);
    setLists(data);
    setSelected((old) =>
      data.some((l) => l.id === old) ? old : (data[0]?.id ?? ""),
    );
  }, [api, householdId]);
  useEffect(() => {
    let alive = true;
    void api
      .lists(householdId)
      .then((data) => {
        if (alive) {
          setLists(data);
          setSelected((old) =>
            data.some((l) => l.id === old) ? old : (data[0]?.id ?? ""),
          );
        }
      })
      .catch(() => {
        if (alive) setMessage("دریافت لیست‌ها ناموفق بود.");
      })
      .finally(() => {
        if (alive) setListsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [api, householdId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve(
      client.rpc("household_member_names", {
        target_household_id: householdId,
      }),
    )
      .then(({ data, error }) => {
        if (alive && !error)
          setMemberNames(
            Object.fromEntries(
              (data ?? [])
                .filter(
                  (member: { id: string; full_name: string | null }) =>
                    member.full_name,
                )
                .map((member: { id: string; full_name: string }) => [
                  member.id,
                  member.full_name,
                ]),
            ),
          );
      })
      .catch(() => {
        /* Names are optional; the list remains usable offline. */
      });
    return () => {
      alive = false;
    };
  }, [client, householdId]);
  useEffect(() => {
    let alive = true;
    // Clear the previous list before requesting the next one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    itemFetchSequence.current++;
    if (selected) {
      setItemsLoading(true);
      void readItems(selected)
        .catch(() => {
          if (alive) setMessage("دریافت اقلام ناموفق بود.");
        })
        .finally(() => {
          if (alive) setItemsLoading(false);
        });
    } else {
      setItemsLoading(false);
    }
    return () => {
      alive = false;
      // Invalidate requests started for a list that is no longer selected.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      itemFetchSequence.current++;
    };
  }, [readItems, selected]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void api
        .lists(householdId)
        .then((data) => {
          if (alive) {
            setLists(data);
            setSelected((old) =>
              data.some((l) => l.id === old) ? old : (data[0]?.id ?? ""),
            );
          }
        })
        .catch(() => {
          if (alive) {
            setLists([]);
            setItems([]);
            setMessage("تازه‌سازی خرید ناموفق بود.");
          }
        });
      if (selected)
        void readItems(selected).catch(() => {
          if (alive) {
            setItems([]);
            setMessage("تازه‌سازی اقلام ناموفق بود.");
          }
        });
    };
    const channel = client
      .channel(`mobile-shopping-${Math.random()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_lists",
          filter: `household_id=eq.${householdId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          ...(selected ? { filter: `list_id=eq.${selected}` } : {}),
        },
        refresh,
      )
      .subscribe((status) => {
        if (alive)
          setSync(
            status === "SUBSCRIBED"
              ? "اتصال زنده برقرار است؛ دریافت همه تغییرات تضمین نشده، تازه‌سازی دستی نیز در دسترس است."
              : "اتصال زنده در دسترس نیست؛ تازه‌سازی کنید.",
          );
      });
    const foreground = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(foreground, 60000);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", foreground);
      void client.removeChannel(channel);
    };
  }, [api, client, householdId, selected, readItems]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          error.message === "تعداد باید بیشتر از صفر باشد."
          ? error.message
          : "عملیات خرید تأیید نشد؛ اطلاعات و اتصال را بررسی کنید و پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reloadListsAfterSave() {
    if (!(await reloadAfterSave(refreshLists))) {
      setLists([]);
      setItems([]);
      setMessage(
        "تغییر ذخیره شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و فهرست را تازه کنید.",
      );
    }
  }
  async function reloadItemsAfterSave(listId: string) {
    if (!(await reloadAfterSave(async () => readItems(listId)))) {
      setItems([]);
      setMessage(
        "تغییر ذخیره شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و فهرست را تازه کنید.",
      );
    }
  }
  async function togglePurchased(item: ShoppingItem, purchased: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    pendingPurchase.current = { id: item.id, value: purchased };
    itemFetchSequence.current++;
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, purchased } : row)),
    );
    try {
      await api.updateItem(item.id, { purchased }, item.purchased);
      pendingPurchase.current = null;
      await reloadItemsAfterSave(selected);
    } catch {
      pendingPurchase.current = null;
      itemFetchSequence.current++;
      setItems([]);
      setMessage(
        "تغییر خرید تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.",
      );
      try {
        await readItems(selected);
      } catch {
        setMessage("وضعیت خرید تأیید نشد؛ فهرست را تازه کنید.");
      }
    } finally {
      setBusy(false);
    }
  }
  function clear() {
    setEditing(null);
    setName("");
    setQuantity("");
    setUnit("");
    setCategory("");
    setNote("");
  }
  function edit(item: ShoppingItem) {
    setEditing(item);
    setName(item.name);
    setQuantity(item.quantity == null ? "" : String(item.quantity));
    setUnit(item.unit ?? "");
    setCategory(item.category ?? "");
    setNote(item.note ?? "");
    setFormOpen(true);
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void action(async () => {
      const value = quantity ? parseAmount(quantity) : null;
      if (quantity && (value === null || value <= 0))
        throw new Error("تعداد باید بیشتر از صفر باشد.");
      const data = {
        name,
        quantity: value,
        unit: unit || null,
        category: category || null,
        note: note || null,
      };
      if (editing) await api.updateItem(editing.id, data);
      else await api.addItem({ listId: selected, ...data });
      clear();
      setFormOpen(false);
      await reloadItemsAfterSave(selected);
    });
  }
  const purchased = items.filter((item) => item.purchased).length;
  const percent = items.length
    ? Math.round((purchased * 100) / items.length)
    : 0;
  const visibleItems = items.filter(
    (item) =>
      (filter === "همه" ||
        (filter === "سایر"
          ? !item.category ||
            !["خوراکی", "خانه", "بهداشتی"].includes(item.category)
          : item.category === filter)) &&
      `${item.name} ${item.note ?? ""}`.includes(query.trim()),
  );
  const categories = [
    { name: "همه", icon: ShoppingBasket },
    { name: "خوراکی", icon: Apple },
    { name: "خانه", icon: House },
    { name: "بهداشتی", icon: SprayCan },
    { name: "سایر", icon: MoreHorizontal },
  ];
  return (
    <div className="shopping-page" dir="rtl">
      <div className="shopping-hero">
        <span className="shopping-branch" aria-hidden="true" />
        <span className="shopping-house" aria-hidden="true" />
        <h2>لیست خرید ما</h2>
        {lists.length > 0 && (
          <label className="shopping-select">
            <span className="shopping-sr">انتخاب لیست</span>
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                clear();
                setFormOpen(false);
                setFilter("همه");
              }}
              aria-label="انتخاب لیست"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="shopping-sync" title={sync}>
          <span />{" "}
          {sync.startsWith("اتصال زنده برقرار")
            ? "اتصال زنده برقرار است"
            : "برای دریافت تغییرات تازه‌سازی کنید"}
        </p>
        <span className="shopping-motto">
          با هم
          <br />
          برای زندگی بهتر
        </span>
      </div>
      {message && (
        <p role="alert" className="error shopping-message">
          {message}
        </p>
      )}
      <details className="shopping-manage">
        <summary>مدیریت لیست‌ها و تازه‌سازی</summary>
        <p>{sync}</p>
        <button
          className="minor"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await refreshLists();
              if (selected) await readItems(selected);
            })
          }
        >
          تازه‌سازی
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const list = await api.createList(householdId, {
                name: listName,
              });
              setSelected(list.id);
              setListName("");
              await reloadListsAfterSave();
            });
          }}
        >
          <label>
            نام لیست جدید
            <input
              required
              minLength={2}
              maxLength={120}
              value={listName}
              onChange={(e) => setListName(e.target.value)}
            />
          </label>
          <button disabled={busy}>ساخت لیست</button>
        </form>
        {selected && (
          <div className="shopping-manage-actions">
            <button
              className="minor"
              disabled={busy}
              onClick={() => {
                const current = lists.find((l) => l.id === selected);
                const next = window.prompt("نام جدید لیست", current?.name);
                if (next !== null)
                  void action(async () => {
                    await api.updateList(selected, next);
                    await reloadListsAfterSave();
                  });
              }}
            >
              ویرایش نام لیست
            </button>
            <button
              className="minor"
              disabled={busy}
              onClick={() => {
                if (window.confirm("لیست بایگانی شود؟"))
                  void action(async () => {
                    await api.archiveList(selected);
                    await reloadListsAfterSave();
                  });
              }}
            >
              بایگانی لیست
            </button>
          </div>
        )}
      </details>
      {selected ? (
        <>
          <div className="shopping-progress">
            <div className="shopping-progress-heading">
              <strong>{percent.toLocaleString("fa-IR")}٪</strong>
              <strong>
                {purchased.toLocaleString("fa-IR")} از{" "}
                {items.length.toLocaleString("fa-IR")} قلم
              </strong>
            </div>
            <div className="shopping-progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
            <p>
              <ShoppingBasket size={21} /> تاکنون{" "}
              {purchased.toLocaleString("fa-IR")} مورد خریداری شده است
            </p>
          </div>
          <div className="shopping-search">
            <button
              type="button"
              aria-label="افزودن قلم جدید"
              disabled={busy}
              onClick={() => {
                clear();
                setFormOpen(true);
              }}
            >
              <Plus size={25} />
            </button>
            <input
              aria-label="جستجو در اقلام"
              placeholder="کالا یا موردی را جستجو کنید..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search size={23} />
          </div>
          <div className="shopping-categories" aria-label="دسته‌بندی اقلام">
            {categories.map(({ name: cat, icon: Icon }) => (
              <button
                type="button"
                key={cat}
                aria-pressed={filter === cat}
                onClick={() => setFilter(cat)}
              >
                <Icon size={20} />
                {cat}
              </button>
            ))}
          </div>
          {formOpen && (
            <div className="shopping-form-card">
              <div className="shopping-form-heading">
                <h3>{editing ? "ویرایش قلم" : "افزودن قلم جدید"}</h3>
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={() => {
                    clear();
                    setFormOpen(false);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={save}>
                <label>
                  نام
                  <input
                    required
                    maxLength={160}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="shopping-form-row">
                  <label>
                    مقدار
                    <input
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  <label>
                    واحد
                    <input
                      maxLength={24}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  دسته
                  <input
                    list="shopping-categories-list"
                    maxLength={60}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  <datalist id="shopping-categories-list">
                    <option value="خوراکی" />
                    <option value="خانه" />
                    <option value="بهداشتی" />
                    <option value="سایر" />
                  </datalist>
                </label>
                <label>
                  یادداشت
                  <input
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button disabled={busy}>ذخیره</button>
              </form>
            </div>
          )}
          <ul className="shopping-items">
            {visibleItems.map((item) => (
              <li
                className={item.purchased ? "is-purchased" : ""}
                key={item.id}
              >
                <details className="shopping-item-menu">
                  <summary aria-label={`عملیات ${item.name}`}>
                    <MoreHorizontal size={22} />
                  </summary>
                  <div>
                    <button disabled={busy} onClick={() => edit(item)}>
                      ویرایش
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("این قلم حذف شود؟"))
                          void action(async () => {
                            await api.deleteItem(item.id);
                            await reloadItemsAfterSave(selected);
                          });
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </details>
                {memberNames[item.added_by] && (
                  <div className="shopping-item-member" title="افزوده‌شده توسط">
                    <span className="shopping-avatar" aria-hidden="true">
                      {memberNames[item.added_by].slice(0, 1)}
                    </span>
                    <span>
                      {memberNames[item.added_by]}
                      <small>افزوده‌کننده</small>
                    </span>
                  </div>
                )}
                <div className="shopping-item-info">
                  <strong>{item.name}</strong>
                  <small>
                    {[item.quantity, item.unit, item.category, item.note]
                      .filter((v) => v !== null && v !== "")
                      .join(" · ")}
                  </small>
                </div>
                <label className="shopping-check">
                  <span className="shopping-sr">{`وضعیت خرید ${item.name}`}</span>
                  <input
                    type="checkbox"
                    checked={item.purchased}
                    disabled={busy}
                    onChange={(e) =>
                      void togglePurchased(item, e.target.checked)
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
          {items.length > 0 && visibleItems.length === 0 && (
            <p className="shopping-no-results">
              موردی در این دسته یا جستجو پیدا نشد.
            </p>
          )}
          <button
            type="button"
            className="shopping-add"
            disabled={busy}
            onClick={() => {
              clear();
              setFormOpen(true);
            }}
          >
            <Plus size={22} /> افزودن قلم جدید
          </button>
          {!itemsLoading && !message && items.length === 0 && (
            <div className="shopping-empty">
              <div>
                <strong>هنوز موردی در لیست نیست</strong>
                <p>با افزودن اولین قلم، خرید دسته‌جمعی را شروع کنید.</p>
              </div>
              <span className="shopping-basket" aria-hidden="true" />
            </div>
          )}
        </>
      ) : listsLoading ? (
        <p role="status">در حال دریافت لیست‌ها…</p>
      ) : !message ? (
        <div className="shopping-empty">
          <div>
            <strong>هنوز لیست خریدی ندارید</strong>
            <p>از بخش مدیریت لیست‌ها، اولین لیست را بسازید.</p>
          </div>
          <span className="shopping-basket" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
