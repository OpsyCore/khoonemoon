import { OfflineScreen } from "@/shared/ui/offline-screen";

/** Public fallback is useful without JS, including on the very first offline navigation. */
export default function OfflinePage() {
  return (
    <main>
      {/* Stable public stylesheet is precached so this fallback works without Next assets. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/offline-screen.css" />
      <OfflineScreen
        actions={
          <>
            <a className="offline-retry" href="/today">
              تلاش مجدد
            </a>
            <a className="offline-back" href="/today">
              بازگشت به امروز
            </a>
          </>
        }
      />
    </main>
  );
}
