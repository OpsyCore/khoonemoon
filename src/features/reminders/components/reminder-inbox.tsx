"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ReminderInboxView,
  type ReminderAction,
} from "@/features/reminders/components/reminder-inbox-view";
import {
  buildReminderInbox,
  type ReminderTarget,
} from "@/features/reminders/inbox";
import type { ReminderRecord } from "@/features/reminders/types";

const SNOOZE_MINUTES: Record<ReminderAction, number> = {
  "snooze-10": 10,
  "snooze-60": 60,
  cancel: 0,
};

export function ReminderInbox({
  reminders,
  tasks,
  events,
  now,
}: {
  reminders: ReminderRecord[];
  tasks: ReminderTarget[];
  events: ReminderTarget[];
  now: Date;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inbox = buildReminderInbox({ reminders, tasks, events, now });

  const handleAction = async (id: string, action: ReminderAction) => {
    setBusyId(id);
    setError(null);

    const response = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "cancel"
          ? { action: "cancel" }
          : { action: "snooze", minutes: SNOOZE_MINUTES[action] },
      ),
    });

    setBusyId(null);

    if (!response.ok) {
      setError(
        action === "cancel"
          ? "لغو یادآور ناموفق بود."
          : "تعویق یادآور ناموفق بود.",
      );
      return;
    }

    router.refresh();
  };

  return (
    <ReminderInboxView
      inbox={inbox}
      now={now}
      hasReminders={reminders.length > 0}
      busyId={busyId}
      error={error}
      onAction={(id, action) => void handleAction(id, action)}
    />
  );
}
