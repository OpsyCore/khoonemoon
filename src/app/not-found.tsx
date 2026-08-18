import Link from "next/link";
import { EmptyState } from "@/shared/ui/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-4">
      <div className="w-full space-y-3">
        <EmptyState
          title="این صفحه پیدا نشد"
          description="ممکن است آدرس را اشتباه وارد کرده باشید."
        />
        <Link
          href="/today"
          className="text-sm text-sky-600 underline dark:text-sky-400"
        >
          بازگشت به امروز
        </Link>
      </div>
    </main>
  );
}
