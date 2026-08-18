import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          اتصال اینترنت قطع است
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          لطفاً اتصال اینترنت را بررسی کنید. پس از اتصال دوباره می‌توانید به
          برنامه برگردید.
        </p>

        <div className="mt-5">
          <Link
            href="/today"
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            تلاش مجدد
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          اگر مشکل ادامه داشت، بعداً دوباره امتحان کنید.
        </p>

        <Link
          href="/today"
          className="mt-3 inline-block text-xs text-sky-600 underline dark:text-sky-400"
        >
          بازگشت به امروز
        </Link>
      </section>
    </main>
  );
}
