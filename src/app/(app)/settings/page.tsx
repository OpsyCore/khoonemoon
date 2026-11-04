import { SettingsReference } from "@/features/settings/components/settings-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای دیدن تنظیمات وارد حساب شوید."
      />
    );
  return <SettingsReference />;
}
