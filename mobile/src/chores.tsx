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
    } catch {
      setMessage("ثبت کار ناموفق بود؛ پیش از تلاش دوباره وضعیت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>کارهای خانه</h2>
      <p>مشاهده و ثبت انجام کار؛ ساخت و ویرایش هنوز منتقل نشده‌اند.</p>
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
