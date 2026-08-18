"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import { signupSchema, type SignupInput } from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signUp({
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
      return;
    }

    setSuccessMessage("ثبت‌نام انجام شد. ایمیل تایید را بررسی کنید.");
    router.refresh();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          ساخت حساب جدید
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
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
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {serverError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {successMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ثبت‌نام
      </Button>

      <p className="text-sm">
        حساب دارید؟{" "}
        <Link
          href="/auth/login"
          className="text-sky-600 underline dark:text-sky-400"
        >
          ورود
        </Link>
      </p>
    </form>
  );
}
