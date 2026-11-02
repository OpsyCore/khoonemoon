"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Documents } from "../../../../mobile/src/documents";

export function DocumentsReference({
  householdId,
}: {
  householdId: string | null;
}) {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Documents
      client={client}
      householdId={householdId}
      onBack={() => router.push("/home")}
    />
  );
}
