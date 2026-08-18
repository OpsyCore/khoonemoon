"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import {
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/features/auth/schemas";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: UpdatePasswordInput) => {
    setServerError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setServerError(getPersianAuthErrorMessage(error));
      return;
    }

    router.replace("/today");
    router.refresh();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          تنظیم رمز عبور جدید
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          رمز عبور جدید حساب خود را وارد کنید.
        </p>
      </div>

      <Input
        label="رمز عبور جدید"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <Input
        label="تکرار رمز عبور جدید"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {serverError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ذخیره رمز عبور
      </Button>
    </form>
  );
}
