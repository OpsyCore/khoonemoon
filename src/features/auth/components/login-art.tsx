import { Leaf } from "lucide-react";
import "./login-art.css";

export function LoginIntro() {
  return (
    <>
      <div className="login-floral login-floral-top" aria-hidden="true" />
      <div className="login-side-quote" aria-hidden="true">
        لحظه‌های
        <br />
        کوچک
        <br />
        آغاز
        <br />
        زندگی بزرگ‌ترند...
        <br />
        <span>♡</span>
      </div>
      <div className="login-top-note" aria-hidden="true">
        <span className="login-top-tape" />
        <p>
          خونه
          <br />
          جاییه که
          <br />
          با هم
          <br />
          قشنگ‌تره ...
          <br />
          <span>♡</span>
        </p>
      </div>
      <div className="login-brand" aria-label="خونه‌مون، زندگی بهتر با هم">
        <svg
          className="login-brand-icon"
          viewBox="0 0 140 140"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M14 47 70 8l56 39"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M44 116c1-31 13-52 36-67"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M49 90C30 82 24 67 26 54c17 4 26 16 23 36ZM57 72C49 56 54 39 65 30c7 17 4 31-8 42ZM70 59c1-14 10-24 23-25-1 13-9 22-23 25ZM43 111c-14-1-24-9-27-20 14-1 24 6 27 20ZM59 89c3-14 14-23 27-22-3 13-13 21-27 22Z"
            fill="currentColor"
          />
          <path
            d="M91 84c-16-13-3-23 5-13 7-10 20 0 4 13l-4 4-5-4Z"
            fill="#bc7657"
          />
        </svg>
        <span className="login-brand-name">خونه‌مون</span>
        <span className="login-brand-tagline">
          <i />
          زندگی بهتر، با هم
          <i />
        </span>
      </div>
      <div className="login-welcome">
        <h1>خوش اومدی به خونه‌مون</h1>
        <div className="login-heart-rule" aria-hidden="true">
          <i />♡<i />
        </div>
        <p>با هم، زندگی شیرین‌تری می‌سازیم</p>
      </div>
    </>
  );
}

export function LoginDivider() {
  return (
    <div className="login-divider" aria-hidden="true">
      <i />
      <Leaf size={22} />
      <i />
    </div>
  );
}

export function LoginBottomArt() {
  return (
    <div className="login-bottom-art" aria-hidden="true">
      <div className="login-still-life" />
      <div className="login-book-labels">
        <span>خانه</span>
        <span>آدم‌ها</span>
        <span>روزهای بهتر</span>
      </div>
      <div className="login-bottom-quote">
        زندگی
        <br />
        همین لحظه‌های
        <br />
        با هم بودن است
        <br />
        ...
      </div>
    </div>
  );
}
