"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Bills } from "../../../mobile/src/bills";
export function BillsReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Bills
      client={client}
      householdId={householdId}
      onReminders={() => router.push("/reminders")}
      onFinance={() => router.push("/finance")}
    />
  );
}
