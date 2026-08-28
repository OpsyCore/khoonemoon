import Link from "next/link";
import { FinanceManager } from "@/features/finance/components/finance-manager";

export default function FinancePage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/home" className="font-medium text-sky-700 dark:text-sky-300">
          خونه
        </Link>
        <span> / مالی</span>
      </p>
      <FinanceManager householdId={null} />
    </div>
  );
}
