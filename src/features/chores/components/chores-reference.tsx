"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChoresDashboard } from "../../../../mobile/src/chores-dashboard";
export function ChoresReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <ChoresDashboard
      client={client}
      householdId={householdId}
      onSettings={() => router.push("/settings")}
      onHouse={() => router.push("/home")}
    />
  );
}
