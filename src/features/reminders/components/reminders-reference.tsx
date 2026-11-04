"use client";
import { useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Reminders } from "../../../../mobile/src/reminders";

export function RemindersReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  return (
    <Reminders
      client={client}
      householdId={householdId}
      notificationStatus=""
    />
  );
}
