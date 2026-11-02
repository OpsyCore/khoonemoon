import { Leaf } from "lucide-react";
import "./login-art.css";

export function LoginIntro() {
  return (
    <>
      <div className="login-floral login-floral-top" aria-hidden="true" />
      <div className="login-brand" aria-label="خونه‌مون">
        <svg
          className="login-brand-icon"
          viewBox="0 0 140 140"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M17 65 70 12l53 53M28 59v62h58M101 43V29h12v27"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M60 50h9v9h-9zm14 0h9v9h-9zM60 64h9v9h-9zm14 0h9v9h-9z"
            stroke="currentColor"
            strokeWidth="2.6"
          />
          <path
            d="M103 120c15-9 24-24 27-44M114 110c-10 0-16-4-18-10 9-1 15 2 18 10Zm7-13c-9-2-12-7-12-13 8 1 12 6 12 13Zm5-13c-5-5-4-12 0-18 5 7 5 12 0 18ZM108 116c4-8 11-11 19-10-4 8-10 11-19 10Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M119 20c-9-8-1-14 3-8 4-6 12-1 3 8l-3 3-3-3Z"
            fill="#bd7454"
          />
        </svg>
        <span>خونه‌مون</span>
      </div>
      <div className="login-welcome">
        <h1>
          <span className="login-heart" aria-hidden="true">
            ♡
          </span>{" "}
          خوش اومدی به خونه‌مون
        </h1>
        <div className="login-heart-rule" aria-hidden="true">
          <i />♥<i />
        </div>
        <p>
          اینجا شروع یک زندگی مشترک و پر از عشق است
          <br />
          بیایید با هم بسازیمش.
        </p>
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
      <div className="login-note">
        <span className="login-note-tape" />
        <p>
          خونه
          <br />
          جاییه که
          <br />
          با تو ♡<br />
          خونه میشه...
        </p>
        <Leaf size={32} />
      </div>
      <div className="login-floral login-floral-bottom" />
    </div>
  );
}
