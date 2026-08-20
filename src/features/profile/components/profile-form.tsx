"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { profileSchema } from "@/features/profile/schema";
import type { ProfileRecord } from "@/features/profile/types";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { z } from "zod";

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({
  profile,
}: {
  profile: Pick<ProfileRecord, "full_name" | "timezone" | "locale">;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      timezone: profile.timezone,
      locale: profile.locale,
    },
  });

  async function onSubmit(values: ProfileFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setErrorMessage(data.message || "بروزرسانی انجام نشد.");
      return;
    }

    setSuccessMessage("پروفایل ذخیره شد.");
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <CardTitle>ویرایش پروفایل</CardTitle>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "در حال ذخیره..." : "ذخیره پروفایل"}
        </Button>
      </form>
    </Card>
  );
}
