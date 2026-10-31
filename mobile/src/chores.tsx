import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directChores } from "@/features/chores/direct-client";
import type { ChoreRecord } from "@/features/chores/types";

export function Chores({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string;
}) {
  const api = useMemo(() => directChores(client), [client]);
  const [chores, setChores] = useState<ChoreRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void api
      .list(householdId)
      .then((rows) => {
        if (active) setChores(rows);
      })
      .catch(() => {
        if (active) setMessage("دریافت کارهای خانه ناموفق بود.");
      });
    return () => {
      active = false;
    };
  }, [api, householdId]);
  async function complete(chore: ChoreRecord) {
    if (!window.confirm("انجام این کار ثبت شود؟")) return;
    setBusy(true);
    setMessage("");
    try {
      await api.complete(chore.id);
      setChores(await api.list(householdId));
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("ثبت کار ناموفق بود؛ پیش از تلاش دوباره وضعیت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function rename(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await api.rename(id, name);
      setChores(await api.list(householdId));
      setEditing(null);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("ویرایش کار خانه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    if (!window.confirm("این کار خانه بایگانی شود؟")) return;
    setBusy(true);
    setMessage("");
    try {
      await api.archive(id);
      setChores(await api.list(householdId));
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("بایگانی کار خانه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>کارهای خانه</h2>
      <p>ساخت کار خانه و ویرایش کامل نوبت‌بندی هنوز منتقل نشده‌اند.</p>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <ul>
        {chores.map((chore) => (
          <li key={chore.id}>
            <span>
              {chore.title}
              {chore.next_due_at
                ? ` — ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(chore.next_due_at))}`
                : ""}
            </span>
            <div>
              {editing === chore.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename(chore.id);
                  }}
                >
                  <label>
                    عنوان
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={180}
                      required
                    />
                  </label>
                  <button disabled={busy}>ذخیره</button>
                  <button
                    type="button"
                    className="minor"
                    onClick={() => setEditing(null)}
                  >
                    انصراف
                  </button>
                </form>
              ) : (
                <>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => {
                      setName(chore.title);
                      setEditing(chore.id);
                    }}
                  >
                    ویرایش عنوان
                  </button>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => void archive(chore.id)}
                  >
                    بایگانی
                  </button>
                </>
              )}
            </div>
            <button
              className="minor"
              disabled={busy || !chore.is_active}
              onClick={() => void complete(chore)}
            >
              انجام شد
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
