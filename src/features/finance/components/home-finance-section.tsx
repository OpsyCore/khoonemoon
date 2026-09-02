import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { SectionLabel } from "@/shared/ui/section-label";

export function HomeFinanceSection() {
  return (
    <section id="finance" className="space-y-3">
      <SectionLabel
        action={
          <Link href="/finance" className="hover:underline">
            مشاهده همه ‹
          </Link>
        }
      >
        خلاصه این ماه
      </SectionLabel>

      <Card className="flex min-w-0 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-field bg-olive-soft text-olive-ink">
            <Wallet className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <CardTitle>مدیریت قبض و هزینه</CardTitle>
            <CardDescription>
              قبض‌ها و هزینه‌های شخصی یا مشترک خانه — بدون عضویت در خانه هم
              می‌توانید مورد خصوصی ثبت کنید.
            </CardDescription>
          </div>
        </div>
        <Link
          href="/finance#quick-add-finance"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-paper px-4 text-[13px] font-medium text-ink transition hover:bg-sunken"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          مورد جدید
        </Link>
      </Card>
    </section>
  );
}
