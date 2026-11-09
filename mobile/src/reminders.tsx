import {
  filterReminderInbox,
  type ReminderHubFilter,
} from "@/features/reminders/reference-filter";
import {
  AlarmClock,
  CalendarDays,
  Check,
  TriangleAlert,
  Clock,
  FileText,
  List,
  MoreHorizontal,
  Settings,
  Sprout,
  X,
  Bell,
  Plus,
} from "lucide-react";
import { formatPersianDate } from "@/shared/utils/locale";
import { completeReminderTarget } from "./reminder-completion";
import "./reminders.css";
import { BrowserPushSettings } from "./browser-push-settings";
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
import { describeTaskCadence } from "@/features/tasks/cleaning";
import { directCalendar } from "@/features/calendar/direct-client";
import { nextOccasionBaseAt } from "@/features/calendar/occasions";
import { directChores } from "@/features/chores/direct-client";
import { directFinance } from "@/features/finance/direct-client";
import { loadHouseholdMembers } from "@/features/households/members";
import {
  buildReminderInbox,
  countReminderHorizons,
} from "@/features/reminders/inbox";
import {
  REMINDER_GROUP_LABELS,
  type ReminderRecord,
  type ReminderPreferenceRecord,
  type ReminderSourceGroup,
  type ReminderTargetType,
} from "@/features/reminders/types";
import type { MobilePage } from "./navigation";

const filterLabels: Record<Exclude<ReminderHubFilter, "ALL">, string> = {
  DUE: "سررسیده",
  TODAY: "امروز",
  TOMORROW: "فردا",
  NEXT_7_DAYS: "هفته آینده",
  UPCOMING: "پیش‌رو",
  DELIVERED: "ارسال‌شده",
  CANCELED: "لغوشده",
};

type Target = {
  id: string;
  title: string;
  date: string | null;
  selectable?: boolean;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  group?: ReminderSourceGroup;
  assigneeLabel?: string | null;
  recurrenceLabel?: string | null;
};

const TARGET_PAGE: Record<ReminderTargetType, MobilePage> = {
  TASK: "tasks",
  EVENT: "calendar",
  CHORE: "chores",
  BILL: "bills",
  DOCUMENT: "documents",
  APPLIANCE: "appliances",
  MEAL: "meals",
};

export function Reminders({
  client,
  notificationStatus,
  householdId,
  onNavigate,
}: {
  client: SupabaseClient;
  notificationStatus: string;
  householdId: string | null;
  onNavigate?: (page: MobilePage) => void;
}) {
  const api = useMemo(() => directReminders(client), [client]);
  const [filter, setFilter] = useState<ReminderHubFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState<ReminderSourceGroup | "ALL">(
    "ALL",
  );
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [native, setNative] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNative(!!window.KhoonemoonNotifications);
  }, []);
  const [rows, setRows] = useState<ReminderRecord[]>([]);
  const [tasks, setTasks] = useState<Target[]>([]);
  const [events, setEvents] = useState<Target[]>([]);
  const [chores, setChores] = useState<Target[]>([]);
  const [bills, setBills] = useState<Target[]>([]);
  const [documents, setDocuments] = useState<Target[]>([]);
  const [appliances, setAppliances] = useState<Target[]>([]);
  const [meals, setMeals] = useState<Target[]>([]);
  const [type, setType] = useState<ReminderTargetType>("TASK");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [offsets, setOffsets] = useState<number[]>([0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReminderPreferenceRecord | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");

  const load = useCallback(async () => {
    const safeSelect = async <T,>(
      table: string,
      cols: string,
    ): Promise<T[]> => {
      if (typeof client.from !== "function") return [];
      const res = await client.from(table).select(cols).limit(1000);
      return res.error || !Array.isArray(res.data) ? [] : (res.data as T[]);
    };
    const [r, t, e, c, f, d, a, m, members] = await Promise.all([
      api.list(),
      directTasks(client).list(),
      directCalendar(client).list(),
      householdId
        ? directChores(client).list(householdId)
        : Promise.resolve([]),
      directFinance(client).list(),
      safeSelect<{ id: string; title: string; expires_at: string | null }>(
        "documents",
        "id,title,expires_at",
      ),
      safeSelect<{
        id: string;
        name: string;
        next_service_at: string | null;
        service_interval_days: number | null;
        assignee_id: string | null;
        archived_at: string | null;
      }>(
        "home_appliances",
        "id,name,next_service_at,service_interval_days,assignee_id,archived_at",
      ),
      householdId
        ? safeSelect<{
            id: string;
            title: string;
            meal_date: string;
            assignee: string | null;
          }>("meal_plans", "id,title,meal_date,assignee")
        : Promise.resolve([]),
      householdId
        ? loadHouseholdMembers(client, householdId)
            .then(({ data }) =>
              data.map((member) => ({
                user_id: member.user_id,
                full_name: member.profiles?.[0]?.full_name ?? "کاربر",
              })),
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);
    const memberMap = Object.fromEntries(
      members.map((x) => [x.user_id, x.full_name]),
    );
    setRows(r);
    setLoaded(true);
    setTasks(
      t
        .filter((x) => !x.archived_at)
        .map((x) => ({
          id: x.id,
          title: x.title,
          date: x.due_at,
          priority: x.priority,
          selectable: x.status !== "COMPLETED" && x.status !== "SKIPPED",
          group: x.task_kind === "CLEANING" ? "CLEANING" : "TASK",
          assigneeLabel:
            x.task_assignees
              ?.map((asg) => memberMap[asg.assignee_id])
              .filter(Boolean)
              .join("، ") || null,
          recurrenceLabel: describeTaskCadence(x.task_recurrences?.[0]),
        })),
    );
    setEvents(
      e.map((x) => ({
        id: x.id,
        title: x.title,
        date:
          x.recurrence_calendar === "JALALI_YEARLY" &&
          x.jalali_month &&
          x.jalali_day
            ? nextOccasionBaseAt(x.jalali_month, x.jalali_day).iso
            : x.start_at,
        group: x.occasion_type ? "OCCASION" : "EVENT",
        recurrenceLabel:
          x.recurrence_calendar === "JALALI_YEARLY" ? "سالانه شمسی" : null,
      })),
    );
    setChores(
      c.map((x) => ({
        id: x.id,
        title: x.title,
        date: x.next_due_at,
        selectable: x.is_active,
        group: "CHORE",
        recurrenceLabel: describeTaskCadence({
          frequency: x.frequency,
          interval_days: x.interval_days,
        }),
      })),
    );
    setBills(
      f
        .filter((x) =>
          ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(x.record_type),
        )
        .map((x) => ({
          id: x.id,
          title: x.title,
          date: x.due_at,
          selectable: !x.paid_at,
          group: x.record_type === "BILL" ? "BILL" : "SUBSCRIPTION",
          recurrenceLabel: x.is_recurring ? "تکراری" : null,
        })),
    );
    setDocuments(
      d.map((x) => ({
        id: x.id,
        title: x.title,
        date: x.expires_at ? `${x.expires_at}T09:00:00` : null,
        selectable: true,
        group: "DOCUMENT",
      })),
    );
    setAppliances(
      a.map((x) => ({
        id: x.id,
        title: x.name,
        date: x.next_service_at,
        selectable: !x.archived_at,
        group: "APPLIANCE",
        assigneeLabel: x.assignee_id
          ? (memberMap[x.assignee_id] ?? null)
          : null,
        recurrenceLabel: x.service_interval_days
          ? `هر ${x.service_interval_days.toLocaleString("fa-IR")} روز`
          : null,
      })),
    );
    setMeals(
      m.map((x) => ({
        id: x.id,
        title: x.title,
        date: `${x.meal_date}T09:00:00`,
        selectable: true,
        group: "MEAL",
        assigneeLabel: x.assignee ?? null,
      })),
    );
  }, [api, client, householdId]);

  useEffect(() => {
    let active = true;
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
  }, [api, prefsVersion]);

  const now = new Date();
  const inbox = buildReminderInbox({
    reminders: rows,
    tasks,
    events,
    chores,
    bills,
    documents,
    appliances,
    meals,
    now,
  });
  const horizons = countReminderHorizons(inbox);

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "عملیات یادآور تأیید نشد."} پیش از تلاش دوباره فهرست را تازه کنید.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const base = new Date(date).getTime();
    if (
      !Number.isFinite(base) ||
      offsets.some((minutes) => base - minutes * 60_000 <= Date.now())
    ) {
      setMessage(
        "یک یا چند زمان یادآوری گذشته است؛ تاریخ یا گزینه‌ها را تغییر دهید.",
      );
      return;
    }
    void action(async () => {
      await api.create({
        targetType: type,
        targetId: target,
        baseDateTime: new Date(date).toISOString(),
        offsets: offsets.map((minutesBefore) => ({ minutesBefore })),
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

  const visible = filterReminderInbox(inbox, filter, now, groupFilter);
  const todayCount = filterReminderInbox(inbox, "TODAY", now).length;
  const countByState: Record<Exclude<ReminderHubFilter, "ALL">, number> = {
    DUE: inbox.counts.due,
    TODAY: todayCount,
    TOMORROW: horizons.tomorrow,
    NEXT_7_DAYS: horizons.nextWeek,
    UPCOMING: inbox.counts.upcoming,
    DELIVERED: inbox.counts.delivered,
    CANCELED: inbox.counts.canceled,
  };

  const priorityLabels = {
    LOW: "اولویت کم",
    NORMAL: "اولویت متوسط",
    HIGH: "با اولویت بالا",
    CRITICAL: "اولویت فوری",
  };

  const pools: Record<ReminderTargetType, Target[]> = {
    TASK: tasks,
    EVENT: events,
    CHORE: chores,
    BILL: bills,
    DOCUMENT: documents,
    APPLIANCE: appliances,
    MEAL: meals,
  };

  async function refreshAfterMutation() {
    window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
    window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    try {
      await load();
    } catch {
      setLoaded(false);
      setRows([]);
      setMessage(
        "عملیات ثبت شد اما تازه‌سازی ناموفق بود؛ پیش از تلاش دوباره فهرست را بررسی کنید.",
      );
    }
  }

  return (
    <section className="reminder-ref" dir="rtl">
      <header className="reminder-ref-header">
        <span className="reminder-ref-branch one" aria-hidden="true" />
        <span className="reminder-ref-branch two" aria-hidden="true" />
        <div className="reminder-ref-bell">
          <span className="reminder-ref-bell-art" aria-hidden="true" />
          {loaded && inbox.counts.due > 0 && (
            <span>{inbox.counts.due.toLocaleString("fa-IR")}</span>
          )}
        </div>
        <h1>یادآورهای ما</h1>
        <p>
          هیچ چیز از قلم نمی‌افته،
          <br />
          با هم به یاد می‌مونیم.
        </p>
      </header>
      {message && (
        <p role="alert" className="reminder-ref-error">
          {message}
        </p>
      )}
      <div className="reminder-ref-stats" aria-label="خلاصه یادآورها">
        <button type="button" onClick={() => setFilter("ALL")}>
          <span>
            <List /> {loaded ? rows.length.toLocaleString("fa-IR") : "–"}
          </span>
          همه یادآورها
        </button>
        <button type="button" onClick={() => setFilter("TODAY")}>
          <span>
            <CalendarDays /> {loaded ? todayCount.toLocaleString("fa-IR") : "–"}
          </span>
          یادآور امروز
        </button>
        <button type="button" onClick={() => setFilter("DUE")}>
          <span>
            <TriangleAlert />{" "}
            {loaded ? inbox.counts.due.toLocaleString("fa-IR") : "–"}
          </span>
          نیاز به توجه
        </button>
      </div>
      <nav className="reminder-ref-filters" aria-label="فیلتر یادآورها">
        {(
          [
            "DUE",
            "TODAY",
            "TOMORROW",
            "NEXT_7_DAYS",
            "UPCOMING",
            "DELIVERED",
            "CANCELED",
          ] as Exclude<ReminderHubFilter, "ALL">[]
        ).map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={filter === state}
            onClick={() => setFilter(state)}
          >
            <b>{loaded ? countByState[state].toLocaleString("fa-IR") : "–"}</b>
            {filterLabels[state]}
          </button>
        ))}
      </nav>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          margin: "8px 0 12px",
        }}
      >
        <label style={{ flex: 1 }}>
          گروه‌بندی منبع:{" "}
          <select
            aria-label="فیلتر منبع یادآور"
            value={groupFilter}
            onChange={(e) =>
              setGroupFilter(e.target.value as ReminderSourceGroup | "ALL")
            }
          >
            <option value="ALL">همه منابع خانه</option>
            {(
              Object.entries(REMINDER_GROUP_LABELS) as [
                ReminderSourceGroup,
                string,
              ][]
            ).map(([gKey, gLabel]) => (
              <option key={gKey} value={gKey}>
                {gLabel}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!loaded ? (
        <p role="status">فهرست یادآورها هنوز دریافت نشده است.</p>
      ) : visible.length === 0 ? (
        <p className="reminder-ref-empty">
          {filter === "ALL" && groupFilter === "ALL"
            ? "یادآوری ثبت نشده است."
            : "یادآوری در این دسته نیست."}
        </p>
      ) : (
        <div className="reminder-ref-list">
          {visible.map((entry) => {
            const row = rows.find((r) => r.id === entry.id)!;
            const targetItem = pools[entry.targetType]?.find(
              (t) => t.id === row.target_id,
            );
            const active = ["DUE", "TODAY", "UPCOMING"].includes(entry.state);
            const canComplete =
              active &&
              !!targetItem &&
              targetItem.selectable !== false &&
              (entry.targetType === "TASK" ||
                entry.targetType === "BILL" ||
                entry.targetType === "APPLIANCE" ||
                (entry.targetType === "CHORE" && !!targetItem.date));
            const Icon = {
              TASK: List,
              EVENT: CalendarDays,
              CHORE: Sprout,
              BILL: FileText,
              DOCUMENT: FileText,
              APPLIANCE: Settings,
              MEAL: CalendarDays,
            }[entry.targetType];
            const at = new Date(entry.effectiveAt);
            return (
              <article
                key={entry.id}
                className={`reminder-ref-card ${entry.state.toLowerCase()} ${targetItem?.priority?.toLowerCase() ?? ""}`}
              >
                <div className="reminder-ref-card-head">
                  <span className="reminder-ref-icon">
                    <Icon />
                  </span>
                  <div>
                    <h2>{entry.title}</h2>
                    <p>
                      {REMINDER_GROUP_LABELS[entry.sourceGroup]}
                      {entry.recurrenceLabel
                        ? ` · ${entry.recurrenceLabel}`
                        : ""}
                      {entry.assigneeLabel
                        ? ` · مسئول: ${entry.assigneeLabel}`
                        : ""}
                    </p>
                  </div>
                  {targetItem?.priority && active && (
                    <span className="reminder-ref-priority">
                      ● {priorityLabels[targetItem.priority]}
                    </span>
                  )}
                </div>
                <div className="reminder-ref-time">
                  <span>
                    <CalendarDays />
                    {Number.isNaN(at.getTime())
                      ? "زمان نامعتبر"
                      : formatPersianDate(at)}
                  </span>
                  <span>
                    <Clock />
                    {Number.isNaN(at.getTime())
                      ? ""
                      : new Intl.DateTimeFormat("fa-IR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(at)}
                  </span>
                </div>
                {entry.snoozeCount > 0 && (
                  <small>
                    تعداد تعویق: {entry.snoozeCount.toLocaleString("fa-IR")}
                  </small>
                )}
                {rescheduleId === entry.id && active && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      margin: "8px 0",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="datetime-local"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !rescheduleDate}
                      onClick={() =>
                        void action(async () => {
                          await api.reschedule(
                            entry.id,
                            new Date(rescheduleDate).toISOString(),
                          );
                          setRescheduleId(null);
                          await refreshAfterMutation();
                        })
                      }
                    >
                      ذخیره زمان جدید
                    </button>
                    <button
                      type="button"
                      className="minor"
                      onClick={() => setRescheduleId(null)}
                    >
                      انصراف
                    </button>
                  </div>
                )}
                {active ? (
                  <div className="reminder-ref-actions">
                    {canComplete && (
                      <button
                        type="button"
                        className="reminder-ref-done"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `${entry.targetType === "CHORE" && targetItem?.date ? `نوبت فعلی کار خانه (${formatPersianDate(targetItem.date)})` : entry.targetType === "BILL" ? "پرداخت قبض" : entry.targetType === "APPLIANCE" ? "سرویس وسیله" : "این کار"} انجام شده است؟ با تأیید، همین یادآور فعال نیز لغو می‌شود.`,
                            )
                          )
                            return;
                          void action(async () => {
                            const result = await completeReminderTarget(
                              client,
                              row,
                              targetItem?.date ?? null,
                              () =>
                                api.cancel(
                                  entry.id,
                                  row.updated_at,
                                  entry.targetType,
                                ),
                            );
                            await refreshAfterMutation();
                            if (result === "cancel-unconfirmed")
                              setMessage(
                                "مورد انجام شد اما لغو یادآور تأیید نشد؛ وضعیت آن را بررسی کنید و مورد را دوباره انجام ندهید.",
                              );
                          });
                        }}
                      >
                        <Check /> انجام شد
                      </button>
                    )}
                    {onNavigate && (
                      <button
                        type="button"
                        className="minor"
                        disabled={busy}
                        onClick={() =>
                          onNavigate(TARGET_PAGE[entry.targetType])
                        }
                      >
                        مشاهده منبع
                      </button>
                    )}
                    <details className="reminder-ref-snooze">
                      <summary>
                        <AlarmClock /> یادآوری بعداً
                      </summary>
                      <div>
                        {(
                          [
                            [10, "۱۰ دقیقه بعد"],
                            [60, "یک ساعت بعد"],
                            [720, "۱۲ ساعت بعد"],
                          ] as const
                        ).map(([minutes, lbl]) => (
                          <button
                            key={minutes}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                await api.snooze(
                                  entry.id,
                                  minutes,
                                  entry.targetType,
                                );
                                await refreshAfterMutation();
                              })
                            }
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </details>
                    <details className="reminder-ref-more">
                      <summary aria-label="گزینه‌های بیشتر">
                        <MoreHorizontal />
                      </summary>
                      <div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const d = new Date(entry.effectiveAt);
                            setRescheduleDate(
                              Number.isFinite(d.getTime())
                                ? new Date(
                                    d.getTime() - d.getTimezoneOffset() * 60000,
                                  )
                                    .toISOString()
                                    .slice(0, 16)
                                : "",
                            );
                            setRescheduleId(entry.id);
                          }}
                        >
                          تغییر موعد / ساعت
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("این یادآور لغو شود؟"))
                              void action(async () => {
                                await api.cancel(
                                  entry.id,
                                  row.updated_at,
                                  entry.targetType,
                                );
                                await refreshAfterMutation();
                              });
                          }}
                        >
                          لغو یادآور
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("این یادآور حذف شود؟"))
                              void action(async () => {
                                await api.remove(entry.id, entry.targetType);
                                await refreshAfterMutation();
                              });
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="reminder-ref-history">
                    <span>
                      {entry.state === "DELIVERED" ? <Check /> : <X />}
                      {filterLabels[entry.state]}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("این یادآور حذف شود؟"))
                          void action(async () => {
                            await api.remove(entry.id, entry.targetType);
                            await refreshAfterMutation();
                          });
                      }}
                    >
                      حذف
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <details className="reminder-ref-panel">
        <summary>
          <Plus /> یادآور جدید
        </summary>
        <form onSubmit={save}>
          <h3>یادآور جدید</h3>
          <label>
            نوع منبع
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ReminderTargetType);
                setTarget("");
                setDate("");
              }}
            >
              <option value="TASK">تسک / نظافت</option>
              <option value="EVENT">رویداد / مناسبت</option>
              <option value="CHORE">تقسیم وظایف</option>
              <option value="BILL">قبض / اشتراک / قسط</option>
              <option value="DOCUMENT">انقضای مدرک</option>
              <option value="APPLIANCE">سرویس وسیله</option>
              <option value="MEAL">برنامه غذایی</option>
            </select>
          </label>
          <label>
            مورد
            <select
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                const item = pools[type].find((x) => x.id === e.target.value);
                if (item?.date) {
                  const d = new Date(item.date);
                  if (Number.isFinite(d.getTime())) {
                    setDate(
                      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16),
                    );
                  } else setDate("");
                } else setDate("");
              }}
            >
              <option value="">انتخاب کنید</option>
              {pools[type].map((x) => (
                <option
                  key={x.id}
                  value={x.id}
                  disabled={x.selectable === false}
                >
                  {x.title}
                  {x.selectable === false ? " (غیرفعال)" : ""}
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
          <fieldset className="reminder-offsets">
            <legend>
              چه زمانی یادآوری شود؟ (می‌توانید چند زمان انتخاب کنید)
            </legend>
            {(
              [
                [0, "در زمان تعیین‌شده"],
                [15, "۱۵ دقیقه قبل"],
                [60, "یک ساعت قبل"],
                [1440, "یک روز قبل"],
                [10080, "۷ روز قبل"],
                [43200, "۳۰ روز قبل"],
              ] as const
            ).map(([minutes, label]) => (
              <label key={minutes}>
                <input
                  type="checkbox"
                  checked={offsets.includes(minutes)}
                  onChange={(e) =>
                    setOffsets((values) =>
                      e.target.checked
                        ? [...values, minutes]
                        : values.filter((value) => value !== minutes),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || !loaded || offsets.length === 0}>
            ثبت یادآور
          </button>
        </form>
      </details>
      <details className="reminder-ref-panel">
        <summary>
          <Bell /> اعلان‌ها و تنظیمات
        </summary>
        <p>
          {native
            ? notificationStatus || "در حال بررسی اعلان‌ها…"
            : "تنظیمات اعلان مرورگر در ادامه آمده است."}
        </p>
        {!native ? (
          <BrowserPushSettings
            client={client}
            onChanged={() => setPrefsVersion((value) => value + 1)}
          />
        ) : (
          <>
            <button
              type="button"
              className="minor"
              onClick={() => window.KhoonemoonNotifications?.request()}
            >
              مجوز و تنظیمات اعلان
            </button>
            <p>
              اعلان‌های گوشی به‌صورت دوره‌ای همگام می‌شوند؛ شبکه و محدودیت‌های
              اندروید ممکن است باعث تأخیر یا توقف شوند.
            </p>
          </>
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
                  window.dispatchEvent(
                    new Event("khoonemoon:reminders-changed"),
                  );
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
            <div>
              <p>تنظیمات در دسترس نیست؛ اتصال را بررسی کنید.</p>
              <button
                type="button"
                className="minor"
                onClick={() => setPrefsVersion((n) => n + 1)}
              >
                تلاش دوباره
              </button>
            </div>
          )}
        </details>
      </details>
      <button
        type="button"
        className="minor reminder-ref-refresh"
        disabled={busy}
        onClick={() => void action(load)}
      >
        تازه‌سازی فهرست
      </button>
    </section>
  );
}
