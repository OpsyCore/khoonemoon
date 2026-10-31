import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directTasks } from "@/features/tasks/direct-client";
import type {
  TaskRecord,
  TaskRecurrenceFrequency,
  TaskPriority,
} from "@/features/tasks/types";
import { MemberFields, RepeatFields } from "./schedule-fields";

export function Tasks({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string | null;
}) {
  const api = useMemo(() => directTasks(client), [client]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [shared, setShared] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
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
    return () => {
      active = false;
    };
  }, [api]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        title: newTitle,
        description,
        dueAt: due ? new Date(due).toISOString() : null,
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
      };
      if (editing) await api.update(editing, payload);
      else await api.create(payload);
      setTasks(await api.list());
      resetForm();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("ذخیره تسک ناموفق بود؛ اطلاعات و تنظیم تکرار را بررسی کنید.");
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
      setTasks(await api.list());
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
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
  function beginEdit(task: TaskRecord) {
    const local = (iso: string) => {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    const recurrence = task.task_recurrences?.[0];
    setEditing(task.id);
    setNewTitle(task.title);
    setDescription(task.description ?? "");
    setDue(task.due_at ? local(task.due_at) : "");
    setShared(task.visibility === "HOUSEHOLD_SHARED");
    setPriority(task.priority);
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
      setTasks(await api.list());
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("بایگانی تسک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>تسک‌ها</h2>
      <form onSubmit={(e) => void create(e)}>
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
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <div>
              <span>{task.title}</span>
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
            {task.status === "COMPLETED" &&
            task.task_recurrences?.some((r) => r.frequency !== "NONE") ? (
              <span>انجام شد؛ نوبت بعدی ایجاد شده است.</span>
            ) : (
              <button
                className="minor"
                disabled={busy}
                onClick={() => void toggle(task)}
              >
                {task.status === "COMPLETED" ? "بازگرداندن" : "انجام شد"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
