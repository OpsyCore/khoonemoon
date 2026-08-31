"use client";

import { resolveOfflineRetryHref } from "@/shared/offline/online-status";
import { useOnlineStatus } from "@/shared/offline/use-online-status";

export function OfflineRetry() {
  const isOnline = useOnlineStatus();

  return (
    <div className="mt-5 space-y-3">
      {!isOnline ? (
        <p className="text-sm text-clay-ink">هنوز آفلاین هستید.</p>
      ) : (
        <p className="text-sm text-olive-ink">
          اتصال برگشته است. می‌توانید به برنامه برگردید.
        </p>
      )}
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-olive px-4 text-sm font-medium text-cream transition hover:bg-olive-deep dark:text-[#221c14]"
        onClick={() => {
          window.location.assign(resolveOfflineRetryHref(isOnline));
        }}
      >
        تلاش مجدد
      </button>
    </div>
  );
}
