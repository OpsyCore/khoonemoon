import { SearchPanel } from "@/features/search/components/search-panel";

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">جستجو</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          بین تسک‌ها، رویدادها، لیست خرید، کارهای خانه و رکوردهای مالی جستجو
          کنید. نتایج همیشه با مجوزهای خانه فیلتر می‌شوند.
        </p>
      </section>

      <SearchPanel />
    </div>
  );
}
