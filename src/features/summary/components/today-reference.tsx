"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Today } from "../../../../mobile/src/today";

export function TodayReference() {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  return (
    <Today
      client={client}
      onTaskChanged={() => router.refresh()}
      onNavigate={(page, section) => {
        if (page === "tasks")
          router.push(`/today?manage=1#${section ?? "task-list"}`);
        else router.push(`/${page}`);
      }}
    />
  );
}
