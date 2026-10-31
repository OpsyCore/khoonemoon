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
  const [name, setName] = useState("");
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
      await api.create({
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
      });
      setTasks(await api.list());
      setNewTitle("");
      setDescription("");
      setDue("");
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("ساخت تسک ناموفق بود؛ اطلاعات و تنظیم تکرار را بررسی کنید.");
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
    } catch {
      setMessage("تغییر وضعیت تسک ناموفق بود؛ دوباره بارگذاری کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function rename(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await api.rename(id, name);
      setTasks(await api.list());
      setEditing(null);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage("ویرایش تسک ناموفق بود.");
    } finally {
      setBusy(false);
    }
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
        <button disabled={busy}>ساخت تسک</button>
      </form>
      <p>ویرایش کامل تنظیمات تسک هنوز منتقل نشده است.</p>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <div>
              {editing === task.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename(task.id);
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
                  <span>{task.title}</span>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => {
                      setName(task.title);
                      setEditing(task.id);
                    }}
                  >
                    ویرایش عنوان
                  </button>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => void archive(task.id)}
                  >
                    بایگانی
                  </button>
                </>
              )}
            </div>
            <button
              className="minor"
              disabled={busy}
              onClick={() => void toggle(task)}
            >
              {task.status === "COMPLETED" ? "بازگرداندن" : "انجام شد"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
