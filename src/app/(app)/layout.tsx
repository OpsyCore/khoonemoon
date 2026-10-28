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

  return (
    <AppShell hasHousehold={Boolean(membership?.household_id)}>
      {children}
    </AppShell>
  );
}
