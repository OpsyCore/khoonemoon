"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  updateHouseholdSchema,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
  type UpdateHouseholdInput,
} from "@/features/households/schemas";
import type {
  HouseholdInvitation,
  HouseholdMember,
  HouseholdRole,
  HouseholdSummary,
} from "@/features/households/types";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { formatPersianDate, formatPersianTime } from "@/shared/utils/locale";

type HouseholdManagerProps = {
  household: HouseholdSummary | null;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
  role: HouseholdRole | null;
  prefillInviteCode?: string;
};

export function HouseholdManager({
  household,
  members,
  invitations,
  role,
  prefillInviteCode,
}: HouseholdManagerProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{
    code: string;
    inviteUrl: string;
  } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(
    null,
  );

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<CreateHouseholdInput>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: {
      name: "",
    },
  });

  const {
    register: registerJoin,
    handleSubmit: handleSubmitJoin,
    formState: { errors: joinErrors, isSubmitting: isJoining },
  } = useForm<JoinHouseholdInput>({
    resolver: zodResolver(joinHouseholdSchema),
    defaultValues: {
      code: prefillInviteCode ?? "",
    },
  });

  const {
    register: registerUpdate,
    handleSubmit: handleSubmitUpdate,
    formState: { errors: updateErrors, isSubmitting: isUpdating },
  } = useForm<UpdateHouseholdInput>({
    resolver: zodResolver(updateHouseholdSchema),
    defaultValues: {
      name: household?.name ?? "",
    },
  });

  const activeInvitationCount = useMemo(
    () => invitations.filter((item) => item.status === "PENDING").length,
    [invitations],
  );

  const onCreateHousehold = async (values: CreateHouseholdInput) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "ایجاد خانه ناموفق بود.");
      return;
    }

    setSuccessMessage("خانه با موفقیت ساخته شد.");
    router.refresh();
  };

  const onJoinHousehold = async (values: JoinHouseholdInput) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "عضویت در خانه ناموفق بود.");
      return;
    }

    setSuccessMessage("با موفقیت به خانه اضافه شدید.");
    router.refresh();
  };

  const onUpdateHouseholdName = async (values: UpdateHouseholdInput) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "بروزرسانی نام خانه انجام نشد.");
      return;
    }

    setSuccessMessage("نام خانه با موفقیت بروزرسانی شد.");
    router.refresh();
  };

  const onGenerateInvite = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedInvite(null);
    setIsGeneratingInvite(true);

    try {
      const response = await fetch("/api/household/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: 72 }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
        inviteUrl?: string;
      };

      if (!response.ok || !payload.code || !payload.inviteUrl) {
        setErrorMessage(payload.message ?? "ایجاد دعوت‌نامه انجام نشد.");
        return;
      }

      setGeneratedInvite({ code: payload.code, inviteUrl: payload.inviteUrl });
      setSuccessMessage("دعوت‌نامه جدید با موفقیت ساخته شد.");
      router.refresh();
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const onCancelInvitation = async (invitationId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCancelingInviteId(invitationId);

    try {
      const response = await fetch(
        `/api/household/invitations/${invitationId}/cancel`,
        {
          method: "POST",
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "لغو دعوت‌نامه ناموفق بود.");
        return;
      }

      setSuccessMessage("دعوت‌نامه لغو شد.");
      router.refresh();
    } finally {
      setCancelingInviteId(null);
    }
  };

  const onLeaveHousehold = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLeaving(true);

    try {
      const response = await fetch("/api/household/leave", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "ترک خانه ناموفق بود.");
        return;
      }

      setSuccessMessage("شما از خانه خارج شدید.");
      router.refresh();
    } finally {
      setIsLeaving(false);
    }
  };

  if (!household) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="هنوز خانه‌ای ندارید"
          description="یک خانه بسازید یا با کد دعوت شریک‌تان وارد خانه شوید."
        />

        <Card className="space-y-3">
          <CardTitle>ساخت خانه جدید</CardTitle>
          <form
            className="space-y-3"
            onSubmit={handleSubmitCreate(onCreateHousehold)}
            noValidate
          >
            <Input
              label="نام خانه"
              placeholder="مثلاً: خونه‌مون"
              error={createErrors.name?.message}
              {...registerCreate("name")}
            />
            <Button type="submit" className="w-full" isLoading={isCreating}>
              ایجاد خانه
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <CardTitle>ورود با کد دعوت</CardTitle>
          <form
            className="space-y-3"
            onSubmit={handleSubmitJoin(onJoinHousehold)}
            noValidate
          >
            <Input
              label="کد دعوت"
              placeholder="کد را وارد کنید"
              error={joinErrors.code?.message}
              {...registerJoin("code")}
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              isLoading={isJoining}
            >
              پیوستن به خانه
            </Button>
          </form>
        </Card>

        {errorMessage ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <CardTitle>{household.name}</CardTitle>
        <CardDescription>
          نقش شما: {role === "OWNER" ? "مالک" : "عضو"} • تعداد اعضای فعال:{" "}
          {members.length}
        </CardDescription>
      </Card>

      <Card className="space-y-3">
        <CardTitle>پروفایل خانه</CardTitle>

        {role === "OWNER" ? (
          <form
            className="space-y-3"
            onSubmit={handleSubmitUpdate(onUpdateHouseholdName)}
            noValidate
          >
            <Input
              label="نام خانه"
              error={updateErrors.name?.message}
              {...registerUpdate("name")}
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              isLoading={isUpdating}
            >
              ذخیره نام خانه
            </Button>
          </form>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            فقط مالک می‌تواند نام خانه را تغییر دهد.
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>اعضای خانه</CardTitle>
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {member.profiles?.[0]?.full_name?.trim() || "کاربر بدون نام"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {member.role === "OWNER" ? "مالک" : "عضو"} • عضویت از{" "}
                {formatPersianDate(new Date(member.joined_at))}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>دعوت شریک</CardTitle>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            دعوت فعال: {activeInvitationCount}
          </span>
        </div>

        {role === "OWNER" ? (
          <Button
            onClick={onGenerateInvite}
            isLoading={isGeneratingInvite}
            className="w-full"
          >
            ایجاد دعوت‌نامه جدید
          </Button>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            فقط مالک می‌تواند دعوت‌نامه جدید بسازد.
          </p>
        )}

        {generatedInvite ? (
          <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs text-zinc-600 dark:text-zinc-300">کد دعوت</p>
            <p className="break-all text-sm font-semibold text-sky-700 dark:text-sky-300">
              {generatedInvite.code}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              لینک دعوت
            </p>
            <p className="break-all text-xs text-sky-700 dark:text-sky-300">
              {generatedInvite.inviteUrl}
            </p>
          </div>
        ) : null}

        <ul className="space-y-2">
          {invitations.map((invitation) => {
            const isPending = invitation.status === "PENDING";
            return (
              <li
                key={invitation.id}
                className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  وضعیت: {invitation.status}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  انقضا: {formatPersianDate(new Date(invitation.expires_at))} -{" "}
                  {formatPersianTime(new Date(invitation.expires_at))}
                </p>

                {role === "OWNER" && isPending ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelingInviteId === invitation.id}
                    onClick={() => onCancelInvitation(invitation.id)}
                    className="mt-2"
                  >
                    لغو دعوت
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="space-y-3 border-rose-200 dark:border-rose-900">
        <CardTitle>ترک خانه</CardTitle>
        <CardDescription>
          اگر مالک باشید و عضو فعال دیگری وجود داشته باشد، فعلاً امکان ترک خانه
          ندارید.
        </CardDescription>
        <Button
          variant="danger"
          onClick={onLeaveHousehold}
          isLoading={isLeaving}
        >
          خروج از خانه
        </Button>
      </Card>

      {errorMessage ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
