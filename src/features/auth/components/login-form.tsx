"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { openSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import { safeRedirectPath } from "@/features/auth/safe-redirect";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { LoginIntro, LoginDivider, LoginBottomArt } from "./login-art";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeRedirectPath(searchParams.get("next"));
  const callbackError = searchParams.get("error");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);

    const opened = openSupabaseBrowserClient();

    if ("error" in opened) {
      setServerError(opened.error);
      return;
    }

    const supabase = opened.client;

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError("ورود ناموفق بود. ایمیل یا رمز عبور را بررسی کنید.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  return (
    <div className="login-page" dir="rtl">
      <LoginIntro />
      <form
        method="post"
        className="login-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <label className="login-field">
          <span className="login-sr-only">ایمیل</span>
          <Mail size={22} aria-hidden="true" />
          <input
            type="email"
            autoComplete="email"
            placeholder="ایمیل شما"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
        </label>
        {errors.email && (
          <p id="login-email-error" role="alert" className="login-error">
            {errors.email.message}
          </p>
        )}
        <label className="login-field login-password-field">
          <span className="login-sr-only">رمز عبور</span>
          <LockKeyhole size={22} aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="رمز عبور شما"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            {...register("password")}
          />
          <button
            type="button"
            className="login-eye"
            aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <Eye size={22} /> : <EyeOff size={22} />}
          </button>
        </label>
        {errors.password && (
          <p id="login-password-error" role="alert" className="login-error">
            {errors.password.message}
          </p>
        )}
        {callbackError && (
          <p role="alert" className="login-error">
            {getPersianAuthErrorMessage(callbackError)}
          </p>
        )}
        {serverError && (
          <p role="alert" className="login-error">
            {serverError}
          </p>
        )}
        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? "در حال ورود…" : "ورود به خونه‌مون"}{" "}
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <Link href="/auth/forgot-password" className="login-forgot">
          رمز عبورم رو فراموش کردم؟
        </Link>
      </form>
      <LoginDivider />
      <div className="login-signup">
        <p>هنوز عضو خونه‌مون نیستی؟</p>
        <Link href="/auth/signup">
          ثبت‌نام در خونه‌مون <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </div>
      <LoginBottomArt />
    </div>
  );
}
