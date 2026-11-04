import { ChoresReference } from "@/features/chores/components/chores-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
export const dynamic = "force-dynamic";
export default async function ChoresPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return (
      <ErrorState title="دسترسی غیرمجاز" description="ابتدا وارد حساب شوید." />
    );
  const { data: membership, error: memberError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (memberError)
    return (
      <ErrorState
        title="خطا در دریافت عضویت"
        description="اطلاعات خانه در دسترس نیست."
      />
    );
  return <ChoresReference householdId={membership?.household_id ?? null} />;
}
