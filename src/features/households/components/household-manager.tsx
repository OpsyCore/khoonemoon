"use client";

import { House } from "lucide-react";
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
import { BranchDecor } from "@/shared/ui/decor";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianNumber,
} from "@/shared/utils/locale";

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
    reset: resetUpdateForm,
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
      household?: HouseholdSummary;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "بروزرسانی نام خانه انجام نشد.");
      return;
    }

    if (payload.household?.name) {
      resetUpdateForm({ name: payload.household.name });
    } else {
      resetUpdateForm({ name: values.name });
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
      <div className="space-y-5">
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
          <p className="text-sm text-danger-ink">{errorMessage}</p>
        ) : null}
        {successMessage ? (
          <p className="text-sm text-olive-ink">{successMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden p-5">
        <BranchDecor className="pointer-events-none absolute -left-3 -top-2 h-16 w-32 -scale-x-100 opacity-25" />
        <div className="flex items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive-ink">
            <House className="size-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-ink">
              {household.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-muted">
              نقش شما: {role === "OWNER" ? "مالک" : "عضو"} · اعضای فعال:{" "}
              {toPersianNumber(members.length)}
            </p>
          </div>
        </div>
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
          <p className="text-sm text-ink-soft">
            فقط مالک می‌تواند نام خانه را تغییر دهد.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <CardTitle>اعضای خانه</CardTitle>
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const name =
              member.profiles?.[0]?.full_name?.trim() || "کاربر بدون نام";
            return (
              <li key={member.id} className="flex items-center gap-3 py-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-soft text-[13px] font-semibold text-clay-ink">
                  {name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {member.role === "OWNER" ? "مالک" : "عضو"} · عضویت از{" "}
                    {formatPersianDate(new Date(member.joined_at))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>دعوت شریک</CardTitle>
          <span className="text-xs text-muted">
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
          <p className="text-sm text-ink-soft">
            فقط مالک می‌تواند دعوت‌نامه جدید بسازد.
          </p>
        )}

        {generatedInvite ? (
          <div className="space-y-2 rounded-field border border-dashed border-olive/60 bg-olive-soft/60 p-4">
            <p className="text-[11px] font-medium text-muted">کد دعوت</p>
            <p className="break-all text-lg font-bold tracking-wide text-olive-ink">
              {generatedInvite.code}
            </p>
            <p className="pt-1 text-[11px] font-medium text-muted">لینک دعوت</p>
            <p className="break-all text-xs text-olive-ink">
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
                className="rounded-field border border-line bg-paper px-3.5 py-3"
              >
                <p className="text-sm font-medium text-ink">
                  وضعیت: {invitation.status}
                </p>
                <p className="text-xs text-muted">
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

      <Card className="space-y-3 border-danger/30 bg-danger-soft/30 p-5">
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
        <p className="text-sm text-danger-ink">{errorMessage}</p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-olive-ink">{successMessage}</p>
      ) : null}
    </div>
  );
}
