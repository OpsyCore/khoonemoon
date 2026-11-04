import type { ReactNode } from "react";
/** No private data or JavaScript is needed to render the offline fallback. */
export function OfflineScreen({
  actions,
  message,
}: {
  actions: ReactNode;
  message?: string;
}) {
  return (
    <section
      className="offline-reference"
      dir="rtl"
      aria-labelledby="offline-title"
    >
      <span className="offline-branch offline-branch-top" aria-hidden="true" />
      <span className="offline-tape" aria-hidden="true" />
      <div className="offline-content">
        <div
          className="offline-house"
          role="img"
          aria-label="خانه و تابلوی قطع اتصال"
        />
        <h1 id="offline-title">ارتباط قطع شده!</h1>
        <p>
          به نظر می‌رسه اینترنت در دسترس نیست.
          <br />
          اتصالات رو بررسی کن و دوباره تلاش کن.
        </p>
        {message && (
          <p className="offline-note" role="status">
            {message}
          </p>
        )}
        <div className="offline-actions">{actions}</div>
      </div>
      <span className="offline-paper" aria-hidden="true">
        <span>✿</span>
      </span>
      <span
        className="offline-branch offline-branch-bottom"
        aria-hidden="true"
      />
    </section>
  );
}
