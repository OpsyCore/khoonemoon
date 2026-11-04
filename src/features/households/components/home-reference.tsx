"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PendingTransferPanel } from "@/features/households/pending-transfer-panel";
import { HomeDashboard } from "../../../../mobile/src/home-dashboard";

export function HomeReference({
  userId,
  householdId,
  initialInviteCode,
}: {
  userId: string;
  householdId: string | null;
  initialInviteCode?: string;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <HomeDashboard
      key={householdId ?? "no-house"}
      client={client}
      userId={userId}
      householdId={householdId}
      initialInviteCode={initialInviteCode}
      onHouseholdChange={() => router.refresh()}
      onSettings={() => router.push("/settings")}
      onTasks={() => router.push("/today")}
      onCalendar={() => router.push("/calendar")}
      extra={
        <details className="home-ref-transfer">
          <summary>انتقال درخواست نامشخص</summary>
          <PendingTransferPanel userId={userId} householdId={householdId} />
        </details>
      }
    />
  );
}
