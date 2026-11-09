"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Today } from "../../../../mobile/src/today";
import { Tasks } from "../../../../mobile/src/tasks";

export function TodayReference() {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      void client
        .from("household_members")
        .select("household_id")
        .eq("user_id", data.user.id)
        .is("left_at", null)
        .maybeSingle()
        .then(({ data: m }) => {
          if (active) setHouseholdId(m?.household_id ?? null);
        });
    });
    return () => {
      active = false;
    };
  }, [client]);

  return (
    <>
      <Today
        client={client}
        onTaskChanged={() => {
          setRevision((n) => n + 1);
          router.refresh();
        }}
        onNavigate={(page, section) => {
          if (section === "chore-list") router.push("/chores");
          else if (page === "tasks")
            router.push(`/today?manage=1#${section ?? "task-list"}`);
          else router.push(`/${page}`);
        }}
      />
      <details className="today-ref-management">
        <summary>مدیریت همه کارها و برنامه نظافت</summary>
        <Tasks
          key={`web-tasks:${householdId ?? "none"}:${revision}`}
          client={client}
          householdId={householdId}
          onNewTask={() => router.push("/tasks/new")}
        />
      </details>
    </>
  );
}
