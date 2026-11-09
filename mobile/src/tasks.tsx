import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directTasks } from "@/features/tasks/direct-client";
import {
  computeWeeklyCleaningProgress,
  describeTaskCadence,
  toggleChecklistItem,
} from "@/features/tasks/cleaning";
import {
  CLEANING_ZONE_LABELS,
  type CleaningChecklistItem,
  type CleaningZone,
  type TaskKind,
  type TaskRecord,
  type TaskRecurrenceFrequency,
  type TaskPriority,
} from "@/features/tasks/types";
import { loadHouseholdMembers } from "@/features/households/members";
import { formatPersianDate } from "@/shared/utils/locale";
import { MemberFields, RepeatFields } from "./schedule-fields";
import { reloadAfterSave } from "./after-save";
import { taskEditTime } from "./task-edit-time";

export function Tasks({
  client,
  householdId,
  onNewTask,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onNewTask?: () => void;
}) {
  const api = useMemo(() => directTasks(client), [client]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [modeFilter, setModeFilter] = useState<"ALL" | "CLEANING">("ALL");
  const [zoneFilter, setZoneFilter] = useState<CleaningZone | "ALL">("ALL");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [shared, setShared] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [taskKind, setTaskKind] = useState<TaskKind>("GENERAL");
  const [cleaningZone, setCleaningZone] = useState<CleaningZone>("KITCHEN");
  const [checklist, setChecklist] = useState<CleaningChecklistItem[]>([]);
  const [checkInput, setCheckInput] = useState("");
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>("NONE");
  const [interval, setInterval] = useState("1");
  const [days, setDays] = useState<number[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((rows) => {
        if (active) setTasks(rows);
      })
      .catch(() => {
        if (active) setMessage("دریافت تسک‌ها ناموفق بود.");
      });
    if (householdId) {
      void loadHouseholdMembers(client, householdId)
        .then(({ data: members }) => {
          if (!active) return;
          setMemberNames(
            Object.fromEntries(
              members.map((member) => [
                member.user_id,
                member.profiles?.[0]?.full_name ?? "کاربر",
              ]),
            ),
          );
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [api, client, householdId]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const original = editing;
      const time = taskEditTime(
        due,
        original?.due_at ?? null,
        original?.task_recurrences?.[0]?.recurrence_timezone,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      const payload = {
        title: newTitle,
        description,
        dueAt: time.dueAt,
        visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
        priority,
        status: "PENDING",
        assigneeIds: shared ? assignees : [],
        recurrence: {
          frequency,
          ...(frequency === "INTERVAL_DAYS"
            ? { intervalDays: Number(interval) }
            : {}),
          ...(frequency === "WEEKLY" ? { weekdays: days } : {}),
        },
        taskKind,
        cleaningZone: taskKind === "CLEANING" ? cleaningZone : null,
        cleaningChecklist: taskKind === "CLEANING" ? checklist : [],
      };
      if (editing)
        await api.update(
          editing.id,
          payload,
          time.recurrenceTimezone,
          editing.updated_at,
        );
      else await api.create(payload);
      resetForm();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      if (!(await reloadAfterSave(async () => setTasks(await api.list())))) {
        setTasks([]);
        setMessage(
          "تسک ذخیره شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و فهرست را تازه کنید.",
        );
      }
    } catch {
      setMessage(
        "ذخیره تسک تأیید نشد؛ اطلاعات و اتصال را بررسی کنید و پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: TaskRecord) {
    setBusy(true);
    setMessage("");
    try {
      await api.completion(
        task,
        task.status === "COMPLETED" ? "undo" : "complete",
      );
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      if (!(await reloadAfterSave(async () => setTasks(await api.list())))) {
        setTasks([]);
        setMessage(
          "تغییر انجام شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و فهرست را تازه کنید.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تغییر وضعیت تسک ناموفق بود؛ دوباره بارگذاری کنید.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleCheck(task: TaskRecord, itemId: string) {
    setBusy(true);
    setMessage("");
    try {
      const next = toggleChecklistItem(task.cleaning_checklist ?? [], itemId);
      await api.updateChecklist(task, next);
      setTasks(await api.list());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "به‌روزرسانی چک‌لیست ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function carryOverTomorrow(task: TaskRecord) {
    setBusy(true);
    setMessage("");
    try {
      const base = task.due_at ? new Date(task.due_at) : new Date();
      const target = new Date(
        Math.max(Date.now(), base.getTime()) + 24 * 60 * 60 * 1000,
      );
      if (task.due_at) {
        target.setHours(base.getHours(), base.getMinutes(), 0, 0);
        if (target.getTime() <= Date.now())
          target.setDate(target.getDate() + 1);
      } else target.setHours(10, 0, 0, 0);
      await api.carryOver(task, target.toISOString());
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
      setTasks(await api.list());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "انتقال موعد ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(task: TaskRecord) {
    const local = (iso: string) => {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    const recurrence = task.task_recurrences?.[0];
    setEditing(task);
    setNewTitle(task.title);
    setDescription(task.description ?? "");
    setDue(task.due_at ? local(task.due_at) : "");
    setShared(task.visibility === "HOUSEHOLD_SHARED");
    setPriority(task.priority);
    setTaskKind(task.task_kind ?? "GENERAL");
    setCleaningZone(task.cleaning_zone ?? "KITCHEN");
    setChecklist(task.cleaning_checklist ?? []);
    setFrequency(recurrence?.frequency ?? "NONE");
    setInterval(String(recurrence?.interval_days ?? 1));
    setDays(recurrence?.weekdays ?? []);
    setAssignees(task.task_assignees.map((a) => a.assignee_id));
  }

  function resetForm() {
    setEditing(null);
    setNewTitle("");
    setDescription("");
    setDue("");
    setShared(false);
    setPriority("NORMAL");
    setTaskKind("GENERAL");
    setCleaningZone("KITCHEN");
    setChecklist([]);
    setCheckInput("");
    setFrequency("NONE");
    setInterval("1");
    setDays([]);
    setAssignees([]);
  }

  async function archive(id: string) {
    if (!window.confirm("این تسک بایگانی شود؟")) return;
    setBusy(true);
    setMessage("");
    try {
      await api.archive(id);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      if (!(await reloadAfterSave(async () => setTasks(await api.list())))) {
        setTasks([]);
        setMessage(
          "تغییر انجام شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و فهرست را تازه کنید.",
        );
      }
    } catch {
      setMessage(
        "بایگانی تسک تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }

  const weeklyProgress = useMemo(
    () => computeWeeklyCleaningProgress(tasks),
    [tasks],
  );
  const visibleTasks = tasks.filter(
    (t) =>
      (modeFilter === "ALL" || t.task_kind === "CLEANING") &&
      (zoneFilter === "ALL" || t.cleaning_zone === zoneFilter),
  );

  return (
    <section id="task-list" dir="rtl">
      <h2>تسک‌ها و نظافت خانه</h2>
      {weeklyProgress.total > 0 && (
        <div
          className="cleaning-progress-box"
          role="region"
          aria-label="پیشرفت هفتگی نظافت"
        >
          <strong>
            پیشرفت نظافت این هفته:{" "}
            {weeklyProgress.completed.toLocaleString("fa-IR")} از{" "}
            {weeklyProgress.total.toLocaleString("fa-IR")} (
            {(weeklyProgress.percent ?? 0).toLocaleString("fa-IR")}٪)
          </strong>
          <progress
            max={weeklyProgress.total}
            value={weeklyProgress.completed}
            style={{ width: "100%", marginTop: 6 }}
          />
        </div>
      )}
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}
      >
        <button
          type="button"
          className="minor"
          aria-pressed={modeFilter === "ALL"}
          onClick={() => {
            setModeFilter("ALL");
            setZoneFilter("ALL");
          }}
        >
          همه کارها
        </button>
        <button
          type="button"
          className="minor"
          aria-pressed={modeFilter === "CLEANING"}
          onClick={() => setModeFilter("CLEANING")}
        >
          برنامه نظافت
        </button>
        {modeFilter === "CLEANING" && (
          <select
            aria-label="فیلتر منطقه نظافت"
            value={zoneFilter}
            onChange={(e) =>
              setZoneFilter(e.target.value as CleaningZone | "ALL")
            }
          >
            <option value="ALL">همه مناطق خانه</option>
            {(
              Object.entries(CLEANING_ZONE_LABELS) as [CleaningZone, string][]
            ).map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="minor"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage("");
            void api
              .list()
              .then(setTasks)
              .catch(() => setMessage("دریافت تسک‌ها ناموفق بود."))
              .finally(() => setBusy(false));
          }}
        >
          تازه‌سازی تسک‌ها
        </button>
        {onNewTask && (
          <button type="button" onClick={onNewTask}>
            تسک / نظافت جدید
          </button>
        )}
      </div>
      {(!onNewTask || editing) && (
        <form onSubmit={(e) => void create(e)}>
          <label>
            نوع
            <select
              value={taskKind}
              onChange={(e) => setTaskKind(e.target.value as TaskKind)}
            >
              <option value="GENERAL">کار عمومی</option>
              <option value="CLEANING">نظافت خانه</option>
            </select>
          </label>
          {taskKind === "CLEANING" && (
            <>
              <label>
                منطقه خانه
                <select
                  value={cleaningZone}
                  onChange={(e) =>
                    setCleaningZone(e.target.value as CleaningZone)
                  }
                >
                  {(
                    Object.entries(CLEANING_ZONE_LABELS) as [
                      CleaningZone,
                      string,
                    ][]
                  ).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span>چک‌لیست نظافت</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    maxLength={160}
                    value={checkInput}
                    onChange={(e) => setCheckInput(e.target.value)}
                    placeholder="افزودن مورد چک‌لیست..."
                  />
                  <button
                    type="button"
                    className="minor"
                    disabled={!checkInput.trim() || checklist.length >= 30}
                    onClick={() => {
                      const v = checkInput.trim();
                      if (!v) return;
                      setChecklist((prev) => [
                        ...prev,
                        {
                          id: `chk-${Date.now()}-${prev.length}`,
                          title: v,
                          done: false,
                        },
                      ]);
                      setCheckInput("");
                    }}
                  >
                    افزودن
                  </button>
                </div>
                {checklist.length > 0 && (
                  <ul>
                    {checklist.map((item) => (
                      <li key={item.id}>
                        {item.title}{" "}
                        <button
                          type="button"
                          className="minor"
                          onClick={() =>
                            setChecklist((prev) =>
                              prev.filter((x) => x.id !== item.id),
                            )
                          }
                        >
                          حذف
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          <label>
            عنوان تسک
            <input
              required
              minLength={2}
              maxLength={180}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <label>
            توضیحات
            <input
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            سررسید
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          {editing && frequency !== "NONE" && (
            <p>
              تکرار با منطقه زمانی ثبت‌شده انجام می‌شود؛ تغییر سررسید منطقه
              زمانی این دستگاه را اعمال می‌کند.
            </p>
          )}
          <label>
            اولویت
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="LOW">کم</option>
              <option value="NORMAL">عادی</option>
              <option value="HIGH">زیاد</option>
              <option value="CRITICAL">فوری</option>
            </select>
          </label>
          {householdId && (
            <label className="item">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => {
                  setShared(e.target.checked);
                  setAssignees([]);
                }}
              />
              اشتراک با خانه
            </label>
          )}
          {shared && householdId && (
            <MemberFields
              client={client}
              householdId={householdId}
              selected={assignees}
              setSelected={setAssignees}
            />
          )}
          <RepeatFields
            frequency={frequency}
            setFrequency={setFrequency}
            interval={interval}
            setInterval={setInterval}
            days={days}
            setDays={setDays}
          />
          <button disabled={busy}>{editing ? "ذخیره تسک" : "ساخت تسک"}</button>
          {editing && (
            <button type="button" className="minor" onClick={resetForm}>
              انصراف
            </button>
          )}
        </form>
      )}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <ul>
        {visibleTasks.map((task) => {
          const cadence = describeTaskCadence(task.task_recurrences?.[0]);
          const assigneeLabels = task.task_assignees
            .map((a) => memberNames[a.assignee_id])
            .filter(Boolean);
          return (
            <li key={task.id}>
              <div>
                <strong>{task.title}</strong>
                {task.task_kind === "CLEANING" && (
                  <small>
                    {" "}
                    · نظافت
                    {task.cleaning_zone
                      ? ` (${CLEANING_ZONE_LABELS[task.cleaning_zone]})`
                      : ""}
                  </small>
                )}
                {cadence && <small> · {cadence}</small>}
                {task.due_at && (
                  <small> · سررسید: {formatPersianDate(task.due_at)}</small>
                )}
                {assigneeLabels.length > 0 && (
                  <small> · مسئول: {assigneeLabels.join("، ")}</small>
                )}
              </div>
              {task.cleaning_checklist &&
                task.cleaning_checklist.length > 0 && (
                  <ul>
                    {task.cleaning_checklist.map((item) => (
                      <li key={item.id}>
                        <label className="item">
                          <input
                            type="checkbox"
                            disabled={busy || task.status === "COMPLETED"}
                            checked={item.done}
                            onChange={() => void toggleCheck(task, item.id)}
                          />{" "}
                          {item.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {task.status === "COMPLETED" &&
                task.task_recurrences?.some((r) => r.frequency !== "NONE") ? (
                  <span>تسک تکراری انجام‌شده</span>
                ) : (
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => void toggle(task)}
                  >
                    {task.status === "COMPLETED" ? "بازگرداندن" : "انجام شد"}
                  </button>
                )}
                {task.status !== "COMPLETED" && (
                  <button
                    type="button"
                    className="minor"
                    disabled={busy}
                    onClick={() => void carryOverTomorrow(task)}
                  >
                    انتقال به فردا
                  </button>
                )}
                <button
                  className="minor"
                  disabled={busy}
                  onClick={() => beginEdit(task)}
                >
                  ویرایش
                </button>
                <button
                  className="minor"
                  disabled={busy}
                  onClick={() => void archive(task.id)}
                >
                  بایگانی
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
