"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { profileSchema, type ProfileInput } from "@/features/profile/schema";
import type { ProfileRecord } from "@/features/profile/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function ProfileForm({
  profile,
}: {
  profile: Pick<ProfileRecord, "full_name" | "timezone" | "locale">;
}) {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      timezone: profile.timezone,
      locale: profile.locale,
    },
  });

  const onSubmit = async (values: ProfileInput) => {
    setServerError(null);
    setServerMessage(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setServerError("ذخیره پروفایل ناموفق بود. دوباره تلاش کنید.");
      return;
    }

    setServerMessage("پروفایل با موفقیت ذخیره شد.");
  };

  return (
    <form
      className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <Input
        label="نام"
        error={errors.full_name?.message}
        {...register("full_name")}
      />
      <Input
        label="منطقه زمانی"
        error={errors.timezone?.message}
        {...register("timezone")}
      />
      <Input
        label="زبان"
        error={errors.locale?.message}
        {...register("locale")}
      />

      {serverError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {serverError}
        </p>
      ) : null}
      {serverMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {serverMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        ذخیره تغییرات
      </Button>
    </form>
  );
}
