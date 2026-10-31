import {
  useCallback,
  useEffect,
  useMemo,
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
  const [selected, setSelected] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [listName, setListName] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState("برای دریافت تغییرات تازه‌سازی کنید.");
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
      });
    return () => {
      alive = false;
    };
  }, [api, householdId]);
  useEffect(() => {
    let alive = true;
    // Clear the previous list before requesting the next one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    if (selected)
      void api
        .items(selected)
        .then((data) => {
          if (alive) setItems(data);
        })
        .catch(() => {
          if (alive) setMessage("دریافت اقلام ناموفق بود.");
        });
    return () => {
      alive = false;
    };
  }, [api, selected]);
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
        void api
          .items(selected)
          .then((data) => {
            if (alive) setItems(data);
          })
          .catch(() => {
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
    document.addEventListener("visibilitychange", foreground);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", foreground);
      void client.removeChannel(channel);
    };
  }, [api, client, householdId, selected]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage("عملیات خرید ناموفق بود؛ اتصال و اطلاعات را بررسی کنید.");
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
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void action(async () => {
      const value = quantity ? parseAmount(quantity) : null;
      if (quantity && (value === null || value <= 0)) throw new Error();
      const data = {
        name,
        quantity: value,
        unit: unit || null,
        category: category || null,
        note: note || null,
      };
      if (editing) await api.updateItem(editing.id, data);
      else await api.addItem({ listId: selected, ...data });
      setItems(await api.items(selected));
      clear();
    });
  }
  return (
    <section>
      <h2>لیست‌های خرید</h2>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <p>{sync}</p>
      <button
        className="minor"
        disabled={busy}
        onClick={() =>
          void action(async () => {
            await refreshLists();
            if (selected) setItems(await api.items(selected));
          })
        }
      >
        تازه‌سازی
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            const list = await api.createList(householdId, { name: listName });
            await refreshLists();
            setSelected(list.id);
            setListName("");
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
      {lists.length > 0 && (
        <>
          <label>
            انتخاب لیست
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                clear();
              }}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="minor"
            disabled={busy}
            onClick={() => {
              const current = lists.find((l) => l.id === selected);
              const next = window.prompt("نام جدید لیست", current?.name);
              if (next !== null)
                void action(async () => {
                  await api.updateList(selected, next);
                  await refreshLists();
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
                  await refreshLists();
                });
            }}
          >
            بایگانی لیست
          </button>
        </>
      )}
      {selected && (
        <>
          <form onSubmit={save}>
            <h3>{editing ? "ویرایش قلم" : "افزودن قلم"}</h3>
            <label>
              نام
              <input
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
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
            <label>
              دسته
              <input
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
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
            {editing && (
              <button type="button" className="minor" onClick={clear}>
                انصراف
              </button>
            )}
          </form>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <label className="item">
                    <input
                      type="checkbox"
                      checked={item.purchased}
                      disabled={busy}
                      onChange={(e) => {
                        const purchased = e.target.checked;
                        void action(async () => {
                          await api.updateItem(item.id, { purchased });
                          setItems(await api.items(selected));
                        });
                      }}
                    />
                    {item.name}
                  </label>
                  <small>
                    {[item.quantity, item.unit, item.category, item.note]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <div>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => edit(item)}
                  >
                    ویرایش
                  </button>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("این قلم حذف شود؟"))
                        void action(async () => {
                          await api.deleteItem(item.id);
                          setItems(await api.items(selected));
                        });
                    }}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
