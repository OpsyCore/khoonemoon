import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directChores } from "@/features/chores/direct-client";
import type {
  ChoreRecord,
  ChoreRotationMode,
  ChoreCompletion,
} from "@/features/chores/types";
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
  const [history, setHistory] = useState<ChoreCompletion[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
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
  useEffect(() => {
    let active = true;
    void api
      .history(chores.map((c) => c.id))
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) setMessage("دریافت تاریخچه کارهای خانه ناموفق بود.");
      });
    return () => {
      active = false;
    };
  }, [api, chores]);
  useEffect(() => {
    let active = true;
    void client
      .rpc("household_member_names", { target_household_id: householdId })
      .then(({ data, error }) => {
        if (active && !error)
          setMemberNames(
            Object.fromEntries(
              ((data ?? []) as { id: string; full_name: string | null }[]).map(
                (m) => [m.id, m.full_name || "کاربر"],
              ),
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [client, householdId]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        title: newTitle,
        description,
        nextDueAt: due ? new Date(due).toISOString() : null,
        rotationMode: mode,
        assigneeIds: assignees,
        frequency,
        intervalDays: frequency === "INTERVAL_DAYS" ? Number(interval) : null,
        weekdays: frequency === "WEEKLY" ? days : null,
      };
      if (editing) await api.update(editing, payload);
      else await api.create(payload);
      setChores(await api.list(householdId));
      resetForm();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setMessage(
        "ذخیره کار خانه ناموفق بود؛ اطلاعات و نوبت‌بندی را بررسی کنید.",
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
  function beginEdit(chore: ChoreRecord) {
    const local = (iso: string) => {
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    setEditing(chore.id);
    setNewTitle(chore.title);
    setDescription(chore.description ?? "");
    setDue(chore.next_due_at ? local(chore.next_due_at) : "");
    setMode(chore.rotation_mode);
    setFrequency(chore.frequency);
    setInterval(String(chore.interval_days ?? 1));
    setDays(chore.weekdays ?? []);
    setAssignees(
      [...(chore.chore_rotation_steps ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((step) => step.assignee_id),
    );
  }
  function resetForm() {
    setEditing(null);
    setNewTitle("");
    setDescription("");
    setDue("");
    setMode("FIXED");
    setFrequency("WEEKLY");
    setInterval("1");
    setDays([]);
    setAssignees([]);
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
        <button disabled={busy}>
          {editing ? "ذخیره کار خانه" : "ساخت کار خانه"}
        </button>
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
        {chores.map((chore) => (
          <li key={chore.id}>
            <span>
              {chore.title}
              {chore.next_due_at
                ? ` — ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(chore.next_due_at))}`
                : ""}
            </span>
            <div>
              <button
                className="minor"
                disabled={busy}
                onClick={() => beginEdit(chore)}
              >
                ویرایش
              </button>
              <button
                className="minor"
                disabled={busy}
                onClick={() => void archive(chore.id)}
              >
                بایگانی
              </button>
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
      <h3>تاریخچه انجام کارها</h3>
      {history.length === 0 ? (
        <p>هنوز کاری ثبت نشده است.</p>
      ) : (
        <ul>
          {history.map((item) => (
            <li key={item.id}>
              <span>
                {chores.find((c) => c.id === item.chore_id)?.title ??
                  "کار خانه"}{" "}
                — {memberNames[item.completed_by] || "کاربر"}
              </span>
              <time>
                {new Intl.DateTimeFormat("fa-IR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.completed_at))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
