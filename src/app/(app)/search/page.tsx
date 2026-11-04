import { SearchReference } from "@/features/search/components/search-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
export const dynamic = "force-dynamic";
export default async function SearchPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای جستجو وارد حساب خود شوید."
      />
    );
  return <SearchReference userId={user.id} />;
}
