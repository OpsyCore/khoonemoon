import { toPersianNumber } from "@/shared/utils/locale";
export function spendingComparison(change: number | null): string {
  if (change === null) return "هفتهٔ قبل هزینه‌ای برای مقایسه ثبت نشده است.";
  if (change === 0) return "هزینه برابر با هفتهٔ قبل است.";
  return `${toPersianNumber(Math.abs(change))}٪ ${change > 0 ? "بیشتر" : "کمتر"} از هفتهٔ قبل`;
}
