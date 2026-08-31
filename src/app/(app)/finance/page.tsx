import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FinanceManager } from "@/features/finance/components/finance-manager";
import { PageHeader } from "@/shared/ui/page-header";

export default function FinancePage() {
  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition hover:text-ink"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.75} />
          بازگشت به خونه
        </Link>
        <PageHeader
          kicker="دفتر خرج و دخل"
          title="مالی"
          subtitle="قبض‌ها، هزینه‌ها و بودجه خانه با هم و شفاف."
        />
      </div>
      <FinanceManager householdId={null} />
    </div>
  );
}
