import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToday } from "@/features/summary/today-client";
type Today = Awaited<ReturnType<typeof getToday>>;
type Page = "tasks" | "calendar" | "finance" | "reminders";
export function Today({
  client,
  onNavigate,
}: {
  client: SupabaseClient;
  onNavigate: (page: Page) => void;
}) {
  const [value, setValue] = useState<Today | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void getToday(client, new Date())
      .then((v) => {
        if (alive) {
          setValue(v);
          setError("");
        }
      })
      .catch(() => {
        if (alive) {
          setValue(null);
          setError("دریافت اطلاعات امروز ناموفق بود.");
        }
      });
    return () => {
      alive = false;
    };
  }, [client, version]);
  useEffect(() => {
    const changed = () => setVersion((n) => n + 1);
    window.addEventListener("khoonemoon:schedule-changed", changed);
    return () =>
      window.removeEventListener("khoonemoon:schedule-changed", changed);
  }, []);
  return (
    <section>
      <h2>امروز</h2>
      <p>کارهای امروز و معوق، رویدادها، قبض‌ها و یادآورها</p>
      {error && <p role="alert">{error}</p>}
      {!value && !error && <p>در حال دریافت…</p>}
      {value && (
        <div className="today-cards">
          <button className="minor" onClick={() => onNavigate("tasks")}>
            کارها: {value.tasks.length}
          </button>
          <button className="minor" onClick={() => onNavigate("tasks")}>
            کار خانه: {value.chores.length}
          </button>
          <button className="minor" onClick={() => onNavigate("calendar")}>
            رویداد امروز: {value.events.length}
          </button>
          <button className="minor" onClick={() => onNavigate("finance")}>
            قبض: {value.bills.length}
          </button>
          <button className="minor" onClick={() => onNavigate("reminders")}>
            یادآور: {value.reminders.length}
          </button>
        </div>
      )}
      <button className="minor" onClick={() => setVersion((n) => n + 1)}>
        تازه‌سازی امروز
      </button>
    </section>
  );
}
