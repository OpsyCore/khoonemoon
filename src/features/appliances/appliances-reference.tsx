"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Appliances } from "../../../mobile/src/appliances";

export function AppliancesReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Appliances
      client={client}
      householdId={householdId}
      onDocuments={() => router.push("/documents")}
      onFinance={() => router.push("/finance")}
      onReminders={() => router.push("/reminders")}
    />
  );
}
