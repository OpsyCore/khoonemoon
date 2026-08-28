import { SearchManager } from "@/features/search/components/search-manager";
import { readSearchQueryParam } from "@/features/search/query";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  return <SearchManager initialQuery={readSearchQueryParam(params.q)} />;
}
