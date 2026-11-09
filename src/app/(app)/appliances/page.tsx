import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppliancesReference } from "@/features/appliances/appliances-reference";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function AppliancesPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده وسایل و تعمیرات باید وارد حساب شوید."
      />
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
  return <AppliancesReference householdId={data?.household_id ?? null} />;
}
