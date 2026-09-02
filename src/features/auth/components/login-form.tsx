"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getAuthErrorDebugText,
  getPersianAuthErrorMessage,
} from "@/features/auth/error-messages";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/today";
  const callbackError = searchParams.get("error");
  const [serverError, setServerError] = useState<string | null>(null);
  const [debugDetail, setDebugDetail] = useState<string | null>(null);

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
    setDebugDetail(null);
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(getPersianAuthErrorMessage(error));
      setDebugDetail(getAuthErrorDebugText("signInWithPassword", error));
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  return (
    <form
      method="post"
      className="space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-1">
        <h1 className="text-[22px] font-bold text-ink">ورود به خونه‌مون</h1>
        <p className="text-[13px] leading-6 text-muted">
          با حساب خود وارد شوید و کارهای امروزتان را ببینید.
        </p>
      </div>

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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />

      {callbackError ? (
        <p className="text-sm text-danger-ink">
          {getPersianAuthErrorMessage(callbackError)}
        </p>
      ) : null}

      {serverError ? (
        <p className="text-sm text-danger-ink">{serverError}</p>
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
        ورود
      </Button>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href="/auth/forgot-password"
          className="font-medium text-clay-ink underline decoration-clay/40 underline-offset-4"
        >
          رمز عبور را فراموش کرده‌اید؟
        </Link>
        <Link
          href="/auth/signup"
          className="font-medium text-clay-ink underline decoration-clay/40 underline-offset-4"
        >
          ساخت حساب
        </Link>
      </div>
    </form>
  );
}
