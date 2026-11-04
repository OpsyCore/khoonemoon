import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchDueReminderCount(
  client: SupabaseClient,
  userId: string,
  now: Date,
): Promise<number | null> {
  const at = now.toISOString();
  const { count, error } = await client
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("delivered_at", null)
    .or(
      `and(status.eq.PENDING,remind_at.lte.${at}),and(status.eq.SNOOZED,snoozed_until.lte.${at}),and(status.eq.SNOOZED,snoozed_until.is.null,remind_at.lte.${at})`,
    );
  if (error) throw new Error("دریافت تعداد یادآورها ناموفق بود.");
  return count;
}

/** The server counts only this authenticated user's due, undelivered reminders. */
export function useDueReminderCount(
  client: SupabaseClient | null,
  userId: string | undefined,
): number | null {
  const [snapshot, setSnapshot] = useState<{
    userId: string;
    count: number | null;
  } | null>(null);
  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    let version = 0;
    const refresh = async () => {
      const current = ++version;
      try {
        const count = await fetchDueReminderCount(client, userId, new Date());
        if (active && current === version) setSnapshot({ userId, count });
      } catch {
        if (active && current === version) setSnapshot({ userId, count: null });
      }
    };
    void refresh();
    const channel = client
      .channel(`reminder-badge:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reminders",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("khoonemoon:reminders-changed", visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      active = false;
      ++version;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("khoonemoon:reminders-changed", visible);
      void client.removeChannel(channel);
    };
  }, [client, userId]);
  return client && userId && snapshot?.userId === userId
    ? snapshot.count
    : null;
}
