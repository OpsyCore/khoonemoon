import type { FormEvent } from "react";
import { ChevronLeft, Leaf, Mail, Send } from "lucide-react";
import "./recovery-reference.css";

/** Shared appearance only; each platform keeps its existing recovery transport. */
export function RecoveryReference({
  email,
  setEmail,
  busy,
  onSubmit,
  onBack,
  backHref,
  message,
}: {
  email: string;
  setEmail: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack?: () => void;
  backHref?: string;
  message?: string | null;
}) {
  return (
    <div className="recovery-page" dir="rtl">
      <div className="recovery-branch recovery-branch-top" aria-hidden="true" />
      <div className="recovery-brand" aria-label="خونه‌مون">
        <svg viewBox="0 0 120 100" aria-hidden="true" fill="none">
          <path
            d="M20 78V47L60 10l25 24"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinejoin="miter"
          />
          <path
            d="M59 85c5-22 15-36 35-52"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M65 70C53 68 49 60 50 52c12 2 18 9 15 18Zm9-14c-7-10-5-19 2-24 5 9 5 17-2 24Zm8-12c2-10 8-15 17-15-1 9-7 14-17 15ZM67 78c8-11 17-12 23-9-4 8-12 12-23 9Z"
            fill="currentColor"
          />
        </svg>
        <span>Khoonemoon</span>
      </div>
      <div className="recovery-heading">
        <h1>رمز عبورت رو فراموش کردی؟</h1>
        <p>
          نگران نباش، برای همیشه کنار تو هستیم.
          <br />
          آدرس ایمیلت رو وارد کن تا لینک بازیابی رمز عبور برات ارسال کنیم.
        </p>
      </div>
      <div className="recovery-letter" aria-hidden="true">
        <div className="recovery-letter-art" />
        <p>
          گاهی
          <br /> یک شروع تازه
          <br /> همه چیز را
          <br /> زیباتر می‌کند.<span>ـــــــ　❧</span>
        </p>
      </div>
      <form method="post" className="recovery-form" onSubmit={onSubmit}>
        <label htmlFor="recovery-email">آدرس ایمیل</label>
        <div className="recovery-email">
          <Mail size={25} aria-hidden="true" />
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="مثال: you@example.com"
          />
        </div>
        {message && (
          <p role="status" className="recovery-message">
            {message}
          </p>
        )}
        <button type="submit" disabled={busy} className="recovery-submit">
          <Send size={24} aria-hidden="true" />
          {busy ? "در حال ارسال…" : "ارسال لینک بازیابی"}
        </button>
      </form>
      <div className="recovery-divider" aria-hidden="true">
        <i />
        <Leaf size={24} />
        <i />
      </div>
      {backHref ? (
        <a className="recovery-back" href={backHref}>
          بازگشت به صفحه ورود <ChevronLeft size={20} />
        </a>
      ) : (
        <button
          className="recovery-back"
          type="button"
          disabled={busy}
          onClick={onBack}
        >
          بازگشت به صفحه ورود <ChevronLeft size={20} />
        </button>
      )}
      <div
        className="recovery-branch recovery-branch-bottom"
        aria-hidden="true"
      />
    </div>
  );
}
