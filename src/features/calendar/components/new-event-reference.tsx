"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NewEvent } from "../../../../mobile/src/new-event";
export function NewEventReference({
  userId,
  householdId,
  date,
}: {
  userId: string;
  householdId: string | null;
  date?: string;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const initialDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T12:00:00`)
      : undefined;
  return (
    <NewEvent
      client={client}
      userId={userId}
      householdId={householdId}
      initialDate={
        initialDate && Number.isFinite(initialDate.getTime())
          ? initialDate
          : undefined
      }
      onCancel={() => router.push("/calendar")}
      onDone={() => {
        router.push("/calendar");
        router.refresh();
      }}
    />
  );
}
