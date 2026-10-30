import { PageHeader } from "@/shared/ui/page-header";
import { SearchPanel } from "@/features/search/components/search-panel";

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="جستجو"
        subtitle="بین تسک‌ها، رویدادها، لیست خرید، کارهای خانه و رکوردهای مالی جستجو کنید. نتایج همیشه با مجوزهای خانه فیلتر می‌شوند."
        decor
      />

      <SearchPanel />
    </div>
  );
}
