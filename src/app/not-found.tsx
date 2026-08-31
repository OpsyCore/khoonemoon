import Link from "next/link";
import { EmptyState } from "@/shared/ui/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-paper px-4">
      <div className="w-full space-y-2 text-center">
        <p className="text-[44px] font-bold leading-none text-kraft">۴۰۴</p>
        <EmptyState
          title="این صفحه در دفترمون نیست"
          description="ممکن است آدرس را اشتباه وارد کرده باشید یا این برگه جابه‌جا شده باشد."
          action={
            <Link
              href="/today"
              className="inline-flex h-10 items-center rounded-full bg-olive px-5 text-sm font-medium text-cream transition hover:bg-olive-deep dark:text-[#221c14]"
            >
              بازگشت به امروز
            </Link>
          }
        />
      </div>
    </main>
  );
}
