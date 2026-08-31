import Link from "next/link";
import { WifiOff } from "lucide-react";
import { OfflineRetry } from "@/app/offline/offline-retry";
import { BranchDecor } from "@/shared/ui/decor";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <section className="w-full max-w-sm rounded-card border border-line bg-card p-7 text-center shadow-paper">
        <BranchDecor className="mx-auto mb-3 opacity-70" />
        <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-clay-soft text-clay-ink">
          <WifiOff className="size-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-lg font-bold text-ink">اتصال اینترنت قطع است</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          لطفاً اتصال اینترنت را بررسی کنید. پس از اتصال دوباره می‌توانید به
          دفترتان برگردید.
        </p>

        <OfflineRetry />

        <p className="mt-4 text-xs text-faint">
          اگر مشکل ادامه داشت، بعداً دوباره امتحان کنید.
        </p>

        <Link
          href="/today"
          className="mt-3 inline-block text-xs font-medium text-clay-ink underline decoration-clay/40 underline-offset-4"
        >
          بازگشت به امروز
        </Link>
      </section>
    </main>
  );
}
