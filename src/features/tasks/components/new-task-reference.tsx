"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NewTask } from "../../../../mobile/src/new-task";
export function NewTaskReference({
  userId,
  householdId,
}: {
  userId: string;
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <NewTask
      client={client}
      userId={userId}
      householdId={householdId}
      onCancel={() => router.push("/today")}
      onDone={() => {
        router.push("/today");
        router.refresh();
      }}
    />
  );
}
