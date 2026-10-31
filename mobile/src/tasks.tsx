import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directTasks } from "@/features/tasks/direct-client";
import type { TaskRecord } from "@/features/tasks/types";

export function Tasks({ client }: { client: SupabaseClient }) {
  const api = useMemo(() => directTasks(client), [client]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
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
      <p>ساخت تسک و ویرایش کامل آن هنوز منتقل نشده‌اند.</p>
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
