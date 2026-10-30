/// <reference types="vite/client" />
import "@fontsource-variable/vazirmatn";
import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { directShopping } from "@/features/shopping/direct-client";
import type { ShoppingItem, ShoppingList } from "@/features/shopping/types";
import { createHouseholdSchema } from "@/features/households/schemas";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Only publishable/anon keys belong in client bundles. A service-role key must
// never be supplied to this build. Database RLS remains the security boundary.
const client = url && anonKey ? createClient(url, anonKey) : null;

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!client);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<string | null | undefined>(
    undefined,
  );
  const [houseName, setHouseName] = useState("");
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [listId, setListId] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [listName, setListName] = useState("");
  const [itemName, setItemName] = useState("");
  const shopping = useMemo(() => (client ? directShopping(client) : null), []);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setReady(true);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    // Clear the previous account’s data before loading the next account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHousehold(undefined);
    setLists([]);
    setListId("");
    setItems([]);
    if (!userId || !client) return;
    let alive = true;
    void client
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .is("left_at", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage("دریافت اطلاعات خانه ناموفق بود.");
        else setHousehold(data?.household_id ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!household || !shopping) return;
    let alive = true;
    void shopping
      .lists(household)
      .then((result) => {
        if (alive) {
          setLists(result);
          setListId(result[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (alive) setMessage("دریافت لیست‌های خرید ناموفق بود.");
      });
    return () => {
      alive = false;
    };
  }, [household, shopping]);

  useEffect(() => {
    // Avoid displaying one list’s contents while another is loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
    if (!listId || !shopping) return;
    let alive = true;
    void shopping
      .items(listId)
      .then((result) => {
        if (alive) setItems(result);
      })
      .catch(() => {
        if (alive) setMessage("دریافت اقلام ناموفق بود.");
      });
    return () => {
      alive = false;
    };
  }, [listId, shopping]);

  async function action(fn: () => Promise<void>) {
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch {
      setMessage("عملیات انجام نشد؛ اطلاعات و اتصال اینترنت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  function login(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
    });
  }
  function createHouse(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const parsed = createHouseholdSchema.parse({ name: houseName });
      const { data, error } = await client.rpc("create_household", {
        p_name: parsed.name,
      });
      if (error || !data) throw error ?? new Error();
      setHousehold(data as string);
      setHouseName("");
    });
  }
  function createList(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!shopping || !household) throw new Error();
      const list = await shopping.createList(household, { name: listName });
      setLists((previous) => [...previous, list]);
      setListId(list.id);
      setListName("");
    });
  }
  function addItem(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!shopping || !listId) throw new Error();
      const item = await shopping.addItem({ listId, name: itemName });
      setItems((previous) => [...previous, item]);
      setItemName("");
    });
  }

  return (
    <main>
      <header>
        <h1>خونه‌مون</h1>
        <p>نسخهٔ اندروید در حال ساخت</p>
      </header>
      <aside>
        این نسخه کامل نیست؛ فعلاً فقط ورود، ساخت خانه و خرید در حال انتقال‌اند.
      </aside>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      {!client ? (
        <section>
          <p>اتصال Supabase برای این ساخت تنظیم نشده است.</p>
        </section>
      ) : !ready ? (
        <p>در حال آماده‌سازی…</p>
      ) : !session ? (
        <section>
          <h2>ورود</h2>
          <form onSubmit={login}>
            <label>
              ایمیل
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              رمز عبور
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>ورود</button>
          </form>
        </section>
      ) : (
        <>
          <section>
            <h2>خانه و اعضا</h2>
            {household === undefined ? (
              <p>در حال دریافت اطلاعات خانه…</p>
            ) : household ? (
              <p>خانهٔ شما متصل است.</p>
            ) : (
              <form onSubmit={createHouse}>
                <label>
                  نام خانه
                  <input
                    value={houseName}
                    onChange={(e) => setHouseName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <button disabled={busy}>ایجاد خانه</button>
              </form>
            )}
          </section>
          {household && (
            <section>
              <h2>لیست خرید</h2>
              {lists.length > 0 && (
                <label>
                  انتخاب لیست
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <form onSubmit={createList}>
                <label>
                  نام لیست جدید
                  <input
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </label>
                <button disabled={busy}>ساخت لیست</button>
              </form>
              {listId && (
                <>
                  <form onSubmit={addItem}>
                    <label>
                      مورد جدید
                      <input
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        maxLength={160}
                        required
                      />
                    </label>
                    <button disabled={busy}>افزودن</button>
                  </form>
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <label className="item">
                          <input
                            type="checkbox"
                            checked={item.purchased}
                            disabled={busy}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              void action(async () => {
                                if (!shopping) return;
                                const updated = await shopping.updateItem(
                                  item.id,
                                  { purchased: checked },
                                );
                                setItems((previous) =>
                                  previous.map((i) =>
                                    i.id === updated.id ? updated : i,
                                  ),
                                );
                              });
                            }}
                          />
                          {item.name}
                        </label>
                        <button
                          className="minor"
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              if (!shopping) return;
                              await shopping.deleteItem(item.id);
                              setItems((previous) =>
                                previous.filter((i) => i.id !== item.id),
                              );
                            })
                          }
                        >
                          حذف
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          <button
            className="minor"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const { error } = await client.auth.signOut();
                if (error) throw error;
              })
            }
          >
            خروج از حساب
          </button>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
