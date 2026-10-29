import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/shared/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function MainAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // The quick-add sheet enables household-only actions (chores, shopping,
  // shared records) based on this flag.
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  // How many reminders have already come due: shown as a badge on the nav so a
  // missed reminder is visible from any page, not only from /today.
  const { count: dueReminderCount } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["PENDING", "SNOOZED"])
    .lte("remind_at", new Date().toISOString());

  return (
    <AppShell
      hasHousehold={Boolean(membership?.household_id)}
      dueReminderCount={dueReminderCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
