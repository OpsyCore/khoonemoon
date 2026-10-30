"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { openSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setServerError(null);
    setSuccessMessage(null);

    const opened = openSupabaseBrowserClient();

    if ("error" in opened) {
      setServerError(opened.error);
      return;
    }

    const supabase = opened.client;

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      setServerError(getPersianAuthErrorMessage(error));
      return;
    }

    setSuccessMessage("لینک بازیابی رمز عبور به ایمیل شما ارسال شد.");
  };

  return (
    <form
      method="post"
      className="space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">بازیابی رمز عبور</h1>
        <p className="text-sm text-ink-soft">
          ایمیل حساب خود را وارد کنید تا لینک بازیابی برایتان ارسال شود.
        </p>
      </div>

      <Input
        label="ایمیل"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      {serverError ? (
        <p className="text-sm text-danger-ink">{serverError}</p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {successMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ارسال لینک بازیابی
      </Button>

      <Link
        href="/auth/login"
        className="block text-sm text-olive-ink underline"
      >
        بازگشت به صفحه ورود
      </Link>
    </form>
  );
}
