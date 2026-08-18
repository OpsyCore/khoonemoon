"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/today";
  const callbackError = searchParams.get("error");
  const [serverError, setServerError] = useState<string | null>(null);

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
    const supabase = createSupabaseBrowserClient();

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
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          ورود به خونه‌مون
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
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
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {getPersianAuthErrorMessage(callbackError)}
        </p>
      ) : null}

      {serverError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ورود
      </Button>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href="/auth/forgot-password"
          className="text-sky-600 underline dark:text-sky-400"
        >
          رمز عبور را فراموش کرده‌اید؟
        </Link>
        <Link
          href="/auth/signup"
          className="text-sky-600 underline dark:text-sky-400"
        >
          ساخت حساب
        </Link>
      </div>
    </form>
  );
}
