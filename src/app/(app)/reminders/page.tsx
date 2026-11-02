import { RemindersReference } from "@/features/reminders/components/reminders-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";
export default async function RemindersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای دیدن یادآورها باید وارد حساب شوید."
      />
    );
  const { data: membership, error: memberError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (memberError)
    return (
      <ErrorState
        title="خطا در دریافت عضویت"
        description="اطلاعات عضویت خانه قابل دریافت نیست."
      />
    );
  return <RemindersReference householdId={membership?.household_id ?? null} />;
}
