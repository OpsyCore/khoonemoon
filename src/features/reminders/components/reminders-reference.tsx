"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Reminders } from "../../../../mobile/src/reminders";

const WEB_ROUTES = {
  tasks: "/today",
  calendar: "/calendar",
  chores: "/chores",
  bills: "/bills",
  documents: "/documents",
  appliances: "/appliances",
  meals: "/meals",
} as const;

export function RemindersReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Reminders
      client={client}
      householdId={householdId}
      notificationStatus=""
      onNavigate={(page) => {
        const href = WEB_ROUTES[page as keyof typeof WEB_ROUTES] ?? "/today";
        router.push(href);
      }}
    />
  );
}
