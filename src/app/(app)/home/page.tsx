import { HomeReference } from "@/features/households/components/home-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
export const dynamic = "force-dynamic";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ inviteCode?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مدیریت خانه باید وارد حساب شوید."
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
  return (
    <HomeReference
      userId={user.id}
      householdId={membership?.household_id ?? null}
      initialInviteCode={params.inviteCode}
    />
  );
}
