import { EmptyState } from "@/shared/ui/empty-state";

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">جستجو</h2>
      <EmptyState
        title="جستجو هنوز راه‌اندازی نشده"
        description="در Milestone 10 جستجو بین تسک‌ها، خرید و قبض‌ها اضافه می‌شود."
      />
    </div>
  );
}
