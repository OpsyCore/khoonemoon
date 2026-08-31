"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getAuthErrorDebugText,
  getPersianAuthErrorMessage,
} from "@/features/auth/error-messages";
import { signupSchema, type SignupInput } from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugDetail, setDebugDetail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupInput) => {
    setServerError(null);
    setSuccessMessage(null);
    setDebugDetail(null);
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setServerError(getPersianAuthErrorMessage(error));
      setDebugDetail(getAuthErrorDebugText("signUp", error));
      return;
    }

    // When "Confirm email" is OFF in Supabase, signUp returns a live session:
    // the user is already logged in — go straight to the app.
    if (data.session) {
      router.replace("/today");
      router.refresh();
      return;
    }

    // Supabase quirk: signUp with an already-registered, confirmed email
    // returns a fake "obfuscated" user with no session and no identities
    // instead of an error. Detect it so the user isn't left waiting for an
    // email that will never arrive.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setServerError("این ایمیل قبلاً ثبت شده است. لطفاً وارد شوید.");
      return;
    }

    // Email confirmation is required: no session yet, a confirmation email
    // has been sent.
    setSuccessMessage(
      "ثبت‌نام انجام شد. لینک تایید به ایمیل شما ارسال شد — تا زمانی که آن را باز نکنید، ورود ممکن نیست.",
    );
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h1 className="text-[22px] font-bold text-ink">ساخت حساب جدید</h1>
        <p className="text-[13px] leading-6 text-muted">
          حساب شخصی خود را بسازید تا وارد فضای مشترک شوید.
        </p>
      </div>

      <Input
        label="نام"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      <Input
        label="ایمیل"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        label="رمز عبور"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        hint="حداقل ۸ کاراکتر"
        {...register("password")}
      />

      {serverError ? (
        <p className="text-sm text-danger-ink">{serverError}</p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-olive-ink">{successMessage}</p>
      ) : null}

      {debugDetail ? (
        <p
          dir="ltr"
          className="rounded-field border border-warn-ink/30 bg-sunken p-2 font-mono text-[11px] leading-5 text-warn-ink"
        >
          DEV: {debugDetail}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ثبت‌نام
      </Button>

      <p className="text-sm">
        حساب دارید؟{" "}
        <Link
          href="/auth/login"
          className="font-medium text-clay-ink underline decoration-clay/40 underline-offset-4"
        >
          ورود
        </Link>
      </p>
    </form>
  );
}
