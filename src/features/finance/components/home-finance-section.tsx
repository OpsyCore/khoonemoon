import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

export function HomeFinanceSection() {
  return (
    <section id="finance" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            مالی
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            قبض‌ها و هزینه‌های یک‌بارهٔ شخصی یا مشترک خانه.
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-2xl bg-sky-600 px-3 text-sm font-medium text-white transition hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          مشاهده
        </Link>
      </div>

      <Card className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Wallet className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0 space-y-1">
            <CardTitle>مدیریت قبض و هزینه</CardTitle>
            <CardDescription>
              بدون عضویت در خانه هم می‌توانید مورد خصوصی ثبت کنید.
            </CardDescription>
          </div>
        </div>
        <Link
          href="/finance#quick-add-finance"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl bg-transparent px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Plus className="size-4" />
          مورد جدید
        </Link>
      </Card>
    </section>
  );
}
