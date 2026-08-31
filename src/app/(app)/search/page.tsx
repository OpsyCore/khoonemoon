import { SearchManager } from "@/features/search/components/search-manager";
import { readSearchQueryParam } from "@/features/search/query";
import { PageHeader } from "@/shared/ui/page-header";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-7">
      <PageHeader
        kicker="ورق زدن دفتر"
        title="جستجو"
        subtitle="در تسک‌ها، رویدادها، لیست‌ها و مدارک جستجو کنید."
      />
      <SearchManager initialQuery={readSearchQueryParam(params.q)} />
    </div>
  );
}
