"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Finance } from "../../../../mobile/src/finance";
export function FinanceReference({
  householdId,
  initialUrl,
}: {
  householdId: string | null;
  initialUrl: string;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <>
      <Finance
        client={client}
        householdId={householdId}
        initialUrl={initialUrl}
        onBack={() => router.push("/home")}
        onSettings={() => router.push("/settings")}
      />
      <Link href="/finance?ledger=1">دفتر مالی قبلی و پیوندهای فیلترشده</Link>
    </>
  );
}
