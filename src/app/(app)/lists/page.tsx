import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { LoadingState } from "@/shared/ui/loading-state";

export default function ListsPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">لیست‌ها</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          خرید، کارهای خانه و لیست‌های شخصی/مشترک در اینجا مدیریت می‌شوند.
        </p>
      </section>

      <Card>
        <CardTitle>خرید هفتگی</CardTitle>
        <CardDescription>نمونه: شیر، برنج، مایع ظرفشویی</CardDescription>
      </Card>

      <LoadingState label="در حال آماده‌سازی لیست‌های هوشمند..." />
    </div>
  );
}
