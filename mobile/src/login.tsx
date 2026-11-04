import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import {
  LoginIntro,
  LoginDivider,
  LoginBottomArt,
} from "@/features/auth/components/login-art";
import { ThemeSettings } from "./theme-settings";
import type { ThemeMode } from "./theme";

export function MobileLogin({
  email,
  setEmail,
  password,
  setPassword,
  busy,
  onSubmit,
  onForgot,
  onSignup,
  theme,
  setTheme,
  themePersisted,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
  onForgot: () => void;
  onSignup: () => void;
  theme: ThemeMode;
  setTheme: (v: ThemeMode) => void;
  themePersisted: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-page" dir="rtl">
      <LoginIntro />
      <form method="post" className="login-form" onSubmit={onSubmit}>
        <label className="login-field">
          <span className="login-sr-only">ایمیل</span>
          <Mail size={22} aria-hidden="true" />
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="ایمیل شما"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="login-field login-password-field">
          <span className="login-sr-only">رمز عبور</span>
          <LockKeyhole size={22} aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="رمز عبور شما"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="login-eye"
            aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <Eye size={22} /> : <EyeOff size={22} />}
          </button>
        </label>
        <button type="submit" className="login-submit" disabled={busy}>
          ورود به خونه‌مون <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="login-forgot"
          disabled={busy}
          onClick={onForgot}
        >
          رمز عبورم رو فراموش کردم؟
        </button>
      </form>
      <LoginDivider />
      <div className="login-signup">
        <p>هنوز عضو خونه‌مون نیستی؟</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onSignup();
          }}
        >
          ثبت‌نام در خونه‌مون <ArrowLeft size={18} aria-hidden="true" />
        </button>
      </div>
      <LoginBottomArt />
      <details className="login-theme">
        <summary>تنظیم ظاهر</summary>
        <ThemeSettings
          mode={theme}
          setMode={setTheme}
          persisted={themePersisted}
        />
      </details>
    </div>
  );
}
