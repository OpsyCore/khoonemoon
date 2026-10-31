import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directTasks } from "@/features/tasks/direct-client";
import type { TaskRecord } from "@/features/tasks/types";

export function Tasks({ client }: { client: SupabaseClient }) {
  const api = useMemo(() => directTasks(client), [client]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
    } catch {
      setMessage("تغییر وضعیت تسک ناموفق بود؛ دوباره بارگذاری کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>تسک‌ها</h2>
      <p>مشاهده و تغییر وضعیت؛ ساخت و ویرایش هنوز منتقل نشده‌اند.</p>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <span>{task.title}</span>
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
