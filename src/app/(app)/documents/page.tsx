import { DocumentsReference } from "@/features/documents/components/documents-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده مدارک وارد حساب شوید."
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
        title="خطا در بارگذاری خانه"
        description="اطلاعات خانه قابل دریافت نیست؛ دوباره تلاش کنید."
      />
    );
  return <DocumentsReference householdId={membership?.household_id ?? null} />;
}
