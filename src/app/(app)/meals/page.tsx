import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MealsReference } from "@/features/meals/meals-reference";
import { ErrorState } from "@/shared/ui/error-state";
export const dynamic = "force-dynamic";
export default async function MealsPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return (
      <ErrorState title="دسترسی غیرمجاز" description="ابتدا وارد حساب شوید." />
    );
  const { data, error } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (error)
    return (
      <ErrorState title="خطا در دریافت عضویت" description="دوباره تلاش کنید." />
    );
  return <MealsReference householdId={data?.household_id ?? null} />;
}
