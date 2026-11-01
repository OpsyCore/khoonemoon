import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToday } from "@/features/summary/today-client";
type Today = Awaited<ReturnType<typeof getToday>>;
type Page = "tasks" | "calendar" | "finance" | "reminders";
export function Today({
  client,
  onNavigate,
  onTaskChanged,
}: {
  client: SupabaseClient;
  onNavigate: (page: Page, section?: "task-list" | "chore-list") => void;
  onTaskChanged: () => void;
}) {
  const [value, setValue] = useState<Today | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  async function completeTask(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: result } = await client.rpc("mobile_complete_task", {
        p_task_id: id,
      });
      if (result) throw result;
      setValue((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.filter((task) => task.id !== id),
            }
          : null,
      );
      onTaskChanged();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setValue(null);
      setError(
        "وضعیت انجام تسک تأیید نشد؛ پیش از تلاش دوباره امروز را تازه‌سازی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
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
          <button
            className="minor"
            onClick={() => onNavigate("tasks", "task-list")}
          >
            کارها: {value.tasks.length}
          </button>
          <button
            className="minor"
            onClick={() => onNavigate("tasks", "chore-list")}
          >
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
      {value && (
        <div className="today-list">
          {[
            {
              label: "کارها",
              page: "tasks" as const,
              section: "task-list" as const,
              rows: value.tasks.map((x) => ({
                id: x.id,
                title: x.title,
                at: x.due_at,
              })),
            },
            {
              label: "کار خانه",
              page: "tasks" as const,
              section: "chore-list" as const,
              rows: value.chores.map((x) => ({
                id: x.id,
                title: x.title,
                at: x.next_due_at,
              })),
            },
            {
              label: "رویدادها",
              page: "calendar" as const,
              section: undefined,
              rows: value.events.map((x) => ({
                id: x.id,
                title: x.title,
                at: x.start_at,
              })),
            },
            {
              label: "قبض‌ها",
              page: "finance" as const,
              section: undefined,
              rows: value.bills.map((x) => ({
                id: x.id,
                title: x.title,
                at: x.due_at,
              })),
            },
          ].map((group) =>
            group.rows.length ? (
              <div key={group.label}>
                <h3>{group.label}</h3>
                <ul>
                  {group.rows.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        {item.at && (
                          <p>
                            {new Intl.DateTimeFormat("fa-IR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(item.at))}
                          </p>
                        )}
                      </div>
                      <div>
                        {group.section === "task-list" && (
                          <button
                            type="button"
                            className="minor"
                            disabled={busy}
                            onClick={() => void completeTask(item.id)}
                          >
                            انجام شد
                          </button>
                        )}
                        <button
                          type="button"
                          className="minor"
                          disabled={busy}
                          onClick={() => onNavigate(group.page, group.section)}
                        >
                          مشاهده
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {group.rows.length > 5 && (
                  <button
                    type="button"
                    className="minor"
                    onClick={() => onNavigate(group.page, group.section)}
                  >
                    مشاهده همه ({group.rows.length})
                  </button>
                )}
              </div>
            ) : null,
          )}
          {value.tasks.length +
            value.chores.length +
            value.events.length +
            value.bills.length ===
            0 && <p>برای امروز موردی در این بخش‌ها ثبت نشده است.</p>}
        </div>
      )}
      <button className="minor" onClick={() => setVersion((n) => n + 1)}>
        تازه‌سازی امروز
      </button>
    </section>
  );
}
