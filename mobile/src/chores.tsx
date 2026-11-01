import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  summarizeChoreHistory,
  groupChoreHistoryByDay,
} from "@/features/chores/history";
import { directChores } from "@/features/chores/direct-client";
import type {
  ChoreRecord,
  ChoreRotationMode,
  ChoreCompletion,
} from "@/features/chores/types";
import type { TaskRecurrenceFrequency } from "@/features/tasks/types";
import { MemberFields, RepeatFields } from "./schedule-fields";
import { taskEditTime } from "./task-edit-time";

export function Chores({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string;
}) {
  const api = useMemo(() => directChores(client), [client]);
  const [chores, setChores] = useState<ChoreRecord[]>([]);
  const [history, setHistory] = useState<
    (ChoreCompletion & { chores: { id: string; title: string } })[]
  >([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ChoreRecord | null>(null);
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
      .householdHistory(
        householdId,
        new Date(Date.now() - 30 * 86400000).toISOString(),
      )
      .then((rows) => {
        if (active) {
          setHistory(rows);
          setHistoryReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setHistoryReady(false);
          setMessage("دریافت تاریخچه کارهای خانه ناموفق بود.");
        }
      });
    return () => {
      active = false;
    };
  }, [api, chores, householdId]);
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
  const historySummary = summarizeChoreHistory({
    completions: history,
    chores: history.map((item) => item.chores),
    members: Object.entries(memberNames).map(([user_id, full_name]) => ({
      user_id,
      full_name,
    })),
    now: new Date(),
  });
  const historyGroups = groupChoreHistoryByDay(historySummary.entries);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const original = editing;
      const time = taskEditTime(
        due,
        original?.next_due_at ?? null,
        original?.recurrence_timezone,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      const payload = {
        title: newTitle,
        description,
        nextDueAt: time.dueAt,
        rotationMode: mode,
        assigneeIds: assignees,
        frequency,
        intervalDays: frequency === "INTERVAL_DAYS" ? Number(interval) : null,
        weekdays: frequency === "WEEKLY" ? days : null,
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
      try {
        setChores(await api.list(householdId));
      } catch {
        setChores([]);
        setMessage(
          "کار ذخیره شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و صفحه را تازه کنید.",
        );
      }
    } catch {
      setMessage(
        "ذخیره تأیید نشد یا اطلاعات معتبر نیست؛ پیش از تلاش دوباره فهرست را تازه کنید.",
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
      if (typeof chore.completion_revision !== "number")
        throw new Error("نسخه کار نامشخص است.");
      await api.completeVersion(chore.id, chore.completion_revision);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      try {
        setChores(await api.list(householdId));
      } catch {
        setChores([]);
        setMessage(
          "انجام کار ثبت شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و صفحه را تازه کنید.",
        );
      }
    } catch {
      setChores([]);
      setMessage("ثبت کار تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleActive(chore: ChoreRecord) {
    setBusy(true);
    setMessage("");
    try {
      await api.setActive(chore.id, chore.is_active);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      try {
        setChores(await api.list(householdId));
      } catch {
        setChores([]);
        setMessage(
          "وضعیت تغییر کرد اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید.",
        );
      }
    } catch {
      setChores([]);
      setMessage("تغییر وضعیت تأیید نشد؛ فهرست را تازه کنید.");
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
    setEditing(chore);
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
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      try {
        setChores(await api.list(householdId));
      } catch {
        setChores([]);
        setMessage(
          "کار بایگانی شد، اما تازه‌سازی ناموفق بود؛ صفحه را تازه کنید.",
        );
      }
    } catch {
      setMessage("بایگانی کار خانه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="chore-list">
      <h2>کارهای خانه</h2>
      <button
        type="button"
        className="minor"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setMessage("");
          void api
            .list(householdId)
            .then(setChores)
            .catch(() => setMessage("دریافت کارهای خانه ناموفق بود."))
            .finally(() => setBusy(false));
        }}
      >
        تازه‌سازی کارهای خانه
      </button>
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
              {chore.title} {!chore.is_active && "(متوقف)"}
              {chore.next_due_at
                ? ` — ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(chore.next_due_at))}`
                : ""}
            </span>
            <div>
              <button
                type="button"
                className="minor"
                disabled={busy}
                onClick={() => void toggleActive(chore)}
              >
                {chore.is_active ? "توقف" : "فعال‌سازی"}
              </button>
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
      <h3>تاریخچه انجام کارها در ۳۰ روز گذشته</h3>
      {!historyReady && <p>تاریخچه هنوز دریافت نشده است.</p>}
      {historyReady && <p>{historySummary.total} مورد ثبت‌شده</p>}
      {historyReady && historySummary.shares.length > 0 && (
        <>
          <h4>سهم اعضا</h4>
          <ul>
            {historySummary.shares.map((share) => (
              <li key={share.memberId}>
                <span>{share.memberName}</span>
                <span>{share.count} مورد</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {historyReady &&
        (historySummary.total === 0 ? (
          <p>در این بازه کاری ثبت نشده است.</p>
        ) : (
          historyGroups.map((group) => (
            <div key={group.key}>
              <h4>{group.label}</h4>
              <ul>
                {group.entries.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.choreTitle} — {item.memberName}
                      {item.note && ` · ${item.note}`}
                    </span>
                    <time>
                      {new Intl.DateTimeFormat("fa-IR", {
                        timeStyle: "short",
                      }).format(new Date(item.completedAt))}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ))}
    </section>
  );
}
