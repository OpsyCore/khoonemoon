"use client";

import { resolveOfflineRetryHref } from "@/shared/offline/online-status";
import { useOnlineStatus } from "@/shared/offline/use-online-status";

export function OfflineRetry() {
  const isOnline = useOnlineStatus();

  return (
    <div className="mt-5 space-y-3">
      {!isOnline ? (
        <p className="text-sm text-rose-700 dark:text-rose-300">
          هنوز آفلاین هستید.
        </p>
      ) : (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          اتصال برگشته است. می‌توانید به برنامه برگردید.
        </p>
      )}
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-500"
        onClick={() => {
          window.location.assign(resolveOfflineRetryHref(isOnline));
        }}
      >
        تلاش مجدد
      </button>
    </div>
  );
}
