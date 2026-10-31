import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReminderRecord,
  ReminderPreferenceRecord,
} from "@/features/reminders/types";
import { directReminders } from "@/features/reminders/direct-client";

declare global {
  interface Window {
    KhoonemoonNotifications?: {
      activate: (account: string) => boolean;
      sync: (account: string, rows: string) => boolean;
      clear: () => void;
      enabled: () => boolean;
      request: () => void;
    };
  }
}
/** The pending notification is postponed to the end of quiet hours in device time. */
export function afterQuietHours(
  at: number,
  preferences: Pick<
    ReminderPreferenceRecord,
    "quiet_hours_enabled" | "quiet_hours_start" | "quiet_hours_end"
  > | null,
): number {
  if (
    !preferences?.quiet_hours_enabled ||
    !preferences.quiet_hours_start ||
    !preferences.quiet_hours_end ||
    !Number.isFinite(at)
  )
    return at;
  const parse = (s: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(s);
    if (!match) return null;
    const h = Number(match[1]),
      m = Number(match[2]);
    return h < 24 && m < 60 ? h * 60 + m : null;
  };
  const start = parse(preferences.quiet_hours_start),
    end = parse(preferences.quiet_hours_end);
  if (start === null || end === null || start === end) return at;
  const date = new Date(at);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const quiet =
    start < end
      ? minutes >= start && minutes < end
      : minutes >= start || minutes < end;
  if (!quiet) return at;
  if (start > end && minutes >= start) date.setDate(date.getDate() + 1);
  date.setHours(Math.floor(end / 60), end % 60, 0, 0);
  return date.getTime();
}
/** No title, file data or tokens cross the bridge. */
export function notificationSchedule(
  rows: ReminderRecord[],
  now: number,
  preferences: ReminderPreferenceRecord | null = null,
) {
  if (preferences && !preferences.in_app_enabled) return [];
  return rows
    .filter(
      (row) =>
        (row.status === "PENDING" || row.status === "SNOOZED") &&
        !row.delivered_at,
    )
    .map((row) => ({
      id: row.id,
      at: afterQuietHours(
        Date.parse(
          row.status === "SNOOZED" && row.snoozed_until
            ? row.snoozed_until
            : row.remind_at,
        ),
        preferences,
      ),
    }))
    .filter((row) => Number.isFinite(row.at) && row.at > now);
}
export function useMobileNotifications(
  client: SupabaseClient | null,
  userId: string | undefined,
  ready: boolean,
) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    const bridge = window.KhoonemoonNotifications;
    if (!bridge || !ready) return;
    if (!userId || !client) {
      bridge.clear();
      return;
    }
    if (!bridge.activate(userId)) return;
    let alive = true;
    let sequence = 0;
    const sync = async () => {
      const serial = ++sequence;
      try {
        const api = directReminders(client);
        const [rows, preferences] = await Promise.all([
          api.list(),
          api.preferences(),
        ]);
        if (!alive || serial !== sequence) return;
        if (
          !bridge.sync(
            userId,
            JSON.stringify(notificationSchedule(rows, Date.now(), preferences)),
          )
        )
          throw new Error();
        setStatus(
          preferences && !preferences.in_app_enabled
            ? "اعلان‌های درون برنامه غیرفعال هستند."
            : bridge.enabled()
              ? "اعلان‌های محلی فعال هستند."
              : "مجوز اعلان در اندروید فعال نیست.",
        );
      } catch {
        if (alive && serial === sequence)
          setStatus(
            "همگام‌سازی اعلان‌ها ناموفق بود؛ یادآورهای جدید ممکن است اعلام نشوند.",
          );
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    void sync();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("khoonemoon:reminders-changed", visible);
    const interval = window.setInterval(visible, 5 * 60 * 1000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("khoonemoon:reminders-changed", visible);
      window.clearInterval(interval);
    };
  }, [client, userId, ready]);
  return status;
}
