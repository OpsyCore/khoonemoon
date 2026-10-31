import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directReminders } from "@/features/reminders/direct-client";
import { directTasks } from "@/features/tasks/direct-client";
import { directCalendar } from "@/features/calendar/direct-client";
import {
  buildReminderInbox,
  type ReminderState,
} from "@/features/reminders/inbox";
import type {
  ReminderRecord,
  ReminderPreferenceRecord,
} from "@/features/reminders/types";

const labels: Record<ReminderState, string> = {
  DUE: "سررسیده",
  TODAY: "امروز",
  UPCOMING: "پیش‌رو",
  DELIVERED: "ارسال‌شده",
  CANCELED: "لغوشده",
};
type Target = { id: string; title: string; date: string | null };
export function Reminders({
  client,
  notificationStatus,
}: {
  client: SupabaseClient;
  notificationStatus: string;
}) {
  const api = useMemo(() => directReminders(client), [client]);
  const [rows, setRows] = useState<ReminderRecord[]>([]);
  const [tasks, setTasks] = useState<Target[]>([]);
  const [events, setEvents] = useState<Target[]>([]);
  const [type, setType] = useState<"TASK" | "EVENT">("TASK");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [offset, setOffset] = useState("0");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReminderPreferenceRecord | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const load = useCallback(async () => {
    const [r, t, e] = await Promise.all([
      api.list(),
      directTasks(client).list(),
      directCalendar(client).list(),
    ]);
    setRows(r);
    setTasks(
      t
        .filter((x) => !x.archived_at)
        .map((x) => ({ id: x.id, title: x.title, date: x.due_at })),
    );
    setEvents(e.map((x) => ({ id: x.id, title: x.title, date: x.start_at })));
  }, [api, client]);
  useEffect(() => {
    let active = true;
    // Initial load reads remote state; updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => {
      if (active) setMessage("دریافت یادآورها و هدف‌ها ناموفق بود.");
    });
    const visible = () => {
      if (document.visibilityState === "visible")
        void load().catch(() => {
          if (active) setMessage("تازه‌سازی یادآورها ناموفق بود.");
        });
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    void api
      .preferences()
      .then((value) => {
        if (!active) return;
        setPrefs(value);
        setEnabled(value?.in_app_enabled ?? true);
        setQuiet(value?.quiet_hours_enabled ?? false);
        setQuietStart(value?.quiet_hours_start ?? "22:00");
        setQuietEnd(value?.quiet_hours_end ?? "08:00");
        setPrefsReady(true);
      })
      .catch(() => {
        if (active) setMessage("دریافت تنظیمات یادآور ناموفق بود.");
      });
    return () => {
      active = false;
    };
  }, [api]);
  const inbox = buildReminderInbox({
    reminders: rows,
    tasks,
    events,
    now: new Date(),
  });
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "عملیات یادآور ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void action(async () => {
      await api.create({
        targetType: type,
        targetId: target,
        baseDateTime: new Date(date).toISOString(),
        offsets: [{ minutesBefore: Number(offset) }],
      });
      setTarget("");
      setDate("");
      window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
      try {
        await load();
      } catch {
        setMessage("یادآور ثبت شد؛ تازه‌سازی ناموفق بود.");
      }
    });
  }
  return (
    <section>
      <h2>یادآورها</h2>
      <p>
        {window.KhoonemoonNotifications
          ? notificationStatus || "در حال بررسی اعلان‌ها…"
          : "اعلان اندروید در این مرورگر در دسترس نیست."}
      </p>
      {window.KhoonemoonNotifications && (
        <>
          <button
            type="button"
            className="minor"
            onClick={() => window.KhoonemoonNotifications?.request()}
          >
            مجوز و تنظیمات اعلان
          </button>
          <p>
            اعلان‌های دریافت‌شده روی این گوشی زمان‌بندی می‌شوند. تغییرات دستگاه
            دیگر تا بازگشت به برنامه همگام نمی‌شوند؛ ممکن است اندروید اعلان را
            با تأخیر نشان دهد.
          </p>
        </>
      )}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <details>
        <summary>تنظیمات یادآور و ساعات سکوت</summary>
        {prefsReady ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api.savePreferences({
                  inAppEnabled: enabled,
                  webPushEnabled: prefs?.web_push_enabled ?? false,
                  quietHoursEnabled: quiet,
                  quietHoursStart: quiet ? quietStart : null,
                  quietHoursEnd: quiet ? quietEnd : null,
                });
                window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
              });
            }}
          >
            <label className="item">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />{" "}
              فعال بودن یادآوری در برنامه و اعلان محلی
            </label>
            <label className="item">
              <input
                type="checkbox"
                checked={quiet}
                onChange={(e) => setQuiet(e.target.checked)}
              />{" "}
              ساعات سکوت
            </label>
            {quiet && (
              <>
                <label>
                  از ساعت
                  <input
                    type="time"
                    required
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                  />
                </label>
                <label>
                  تا ساعت
                  <input
                    type="time"
                    required
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                  />
                </label>
                <small>
                  یادآوری به پایان ساعت سکوت طبق ساعت گوشی موکول می‌شود.
                </small>
              </>
            )}
            <button disabled={busy}>ذخیره تنظیمات</button>
          </form>
        ) : (
          <p>تنظیمات در دسترس نیست؛ اتصال را بررسی کنید.</p>
        )}
      </details>
      <form onSubmit={save}>
        <h3>یادآور جدید</h3>
        <label>
          نوع
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as "TASK" | "EVENT");
              setTarget("");
              setDate("");
            }}
          >
            <option value="TASK">تسک</option>
            <option value="EVENT">رویداد</option>
          </select>
        </label>
        <label>
          مورد
          <select
            required
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              const item = (type === "TASK" ? tasks : events).find(
                (x) => x.id === e.target.value,
              );
              if (item?.date) {
                const d = new Date(item.date);
                setDate(
                  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16),
                );
              } else setDate("");
            }}
          >
            <option value="">انتخاب کنید</option>
            {(type === "TASK" ? tasks : events).map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          تاریخ و زمان مبنا
          <input
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          چه زمانی یادآوری شود؟
          <select value={offset} onChange={(e) => setOffset(e.target.value)}>
            <option value="0">در زمان تعیین‌شده</option>
            <option value="15">۱۵ دقیقه قبل</option>
            <option value="60">یک ساعت قبل</option>
            <option value="1440">یک روز قبل</option>
          </select>
        </label>
        <button disabled={busy}>ثبت یادآور</button>
      </form>
      <button
        type="button"
        className="minor"
        disabled={busy}
        onClick={() => void action(load)}
      >
        تازه‌سازی
      </button>
      {inbox.sections.length === 0 && <p>یادآوری ثبت نشده است.</p>}
      {inbox.sections.map((section) => (
        <div key={section.state}>
          <h3>{labels[section.state]}</h3>
          <ul>
            {section.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <p>
                    {new Intl.DateTimeFormat("fa-IR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.effectiveAt))}
                  </p>
                </div>
                <div>
                  {["DUE", "TODAY", "UPCOMING"].includes(section.state) && (
                    <button
                      className="minor"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await api.snooze(entry.id, 15);
                          window.dispatchEvent(
                            new Event("khoonemoon:reminders-changed"),
                          );
                          await load();
                        })
                      }
                    >
                      ۱۵ دقیقه بعد
                    </button>
                  )}
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("این یادآور حذف شود؟"))
                        void action(async () => {
                          await api.remove(entry.id);
                          window.dispatchEvent(
                            new Event("khoonemoon:reminders-changed"),
                          );
                          await load();
                        });
                    }}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
