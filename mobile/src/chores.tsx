import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directChores } from "@/features/chores/direct-client";
import type { ChoreRecord, ChoreRotationMode } from "@/features/chores/types";
import type { TaskRecurrenceFrequency } from "@/features/tasks/types";
import { MemberFields, RepeatFields } from "./schedule-fields";

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
  const [newTitle, setNewTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [mode, setMode] = useState<ChoreRotationMode>("FIXED");
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>("WEEKLY");
  const [interval, setInterval] = useState("1");
  const [days, setDays] = useState<number[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
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
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.create({
        title: newTitle,
        description,
        nextDueAt: due ? new Date(due).toISOString() : null,
        rotationMode: mode,
        assigneeIds: assignees,
        frequency,
        intervalDays: frequency === "INTERVAL_DAYS" ? Number(interval) : null,
        weekdays: frequency === "WEEKLY" ? days : null,
      });
      setChores(await api.list(householdId));
      setNewTitle("");
      setDescription("");
      setDue("");
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage(
        "ساخت کار خانه ناموفق بود؛ اطلاعات و نوبت‌بندی را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
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
      <form onSubmit={(e) => void create(e)}>
        <label>
          عنوان کار
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
          سررسید بعدی
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label>
          نوبت‌بندی
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ChoreRotationMode)}
          >
            <option value="FIXED">ثابت</option>
            <option value="ROTATING">چرخشی</option>
          </select>
        </label>
        <MemberFields
          client={client}
          householdId={householdId}
          selected={assignees}
          setSelected={setAssignees}
        />
        <RepeatFields
          frequency={frequency}
          setFrequency={setFrequency}
          interval={interval}
          setInterval={setInterval}
          days={days}
          setDays={setDays}
        />
        <button disabled={busy}>ساخت کار خانه</button>
      </form>
      <p>ویرایش کامل نوبت‌بندی هنوز منتقل نشده است.</p>
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
