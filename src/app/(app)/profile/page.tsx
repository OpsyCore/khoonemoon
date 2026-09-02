import {
  Bell,
  ChevronLeft,
  FileText,
  Globe,
  House,
  Mail,
  Settings,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/shared/ui/card";
import { BranchDecor, TapeStrip } from "@/shared/ui/decor";
import { ErrorState } from "@/shared/ui/error-state";
import { HeaderIconLink, PageHeader } from "@/shared/ui/page-header";
import { SectionLabel } from "@/shared/ui/section-label";
import { toPersianNumber } from "@/shared/utils/locale";

export const dynamic = "force-dynamic";

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink-soft">{label}</span>
      <span dir="auto" className="max-w-[55%] truncate text-sm text-ink">
        {value}
      </span>
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-sunken/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft transition group-hover:bg-olive-soft group-hover:text-olive-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? (
          <span className="block text-[11.5px] text-muted">{hint}</span>
        ) : null}
      </span>
      <ChevronLeft className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
    </Link>
  );
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده پروفایل باید وارد حساب شوید."
      />
    );
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, timezone, locale")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("household_id, households(name)")
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle(),
  ]);

  const { data, error } = profileResult;

  const householdRaw = membershipResult.data?.households as
    { name?: string } | { name?: string }[] | null | undefined;
  const householdName = Array.isArray(householdRaw)
    ? householdRaw[0]?.name
    : householdRaw?.name;

  let memberCount: number | null = null;
  if (membershipResult.data?.household_id) {
    const { count } = await supabase
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", membershipResult.data.household_id)
      .is("left_at", null);
    memberCount = count ?? null;
  }

  const fullName = data?.full_name?.trim() || "";

  return (
    <div className="space-y-7">
      <PageHeader
        title="پروفایل"
        subtitle="حساب شما در دفترچه‌ی مشترک."
        action={
          <HeaderIconLink href="/settings" label="تنظیمات">
            <Settings className="size-[18px]" strokeWidth={1.6} />
          </HeaderIconLink>
        }
      />

      <section className="relative flex flex-col items-center gap-2 pt-2 text-center">
        <BranchDecor className="pointer-events-none absolute -top-1 right-[calc(50%+2.25rem)] h-10 w-20 opacity-30" />
        <BranchDecor className="pointer-events-none absolute -top-1 left-[calc(50%+2.25rem)] h-10 w-20 -scale-x-100 opacity-30" />
        <div className="relative">
          <TapeStrip className="absolute -top-3 left-1/2 h-4 w-16 -translate-x-1/2" />
          <span className="flex size-20 items-center justify-center rounded-full border-2 border-card bg-clay-soft text-2xl font-bold text-clay-ink shadow-paper">
            {(fullName || user.email || "؟").slice(0, 1)}
          </span>
        </div>
        <p className="pt-1 text-lg font-bold text-ink">
          {fullName || "بدون نام"}
        </p>
        <p dir="ltr" className="text-[12px] text-muted">
          {user.email}
        </p>
      </section>

      {error ? (
        <ErrorState
          title="خطا در دریافت پروفایل"
          description="لطفاً دوباره تلاش کنید."
        />
      ) : null}

      {!error ? (
        <>
          <section className="space-y-3">
            <SectionLabel>اطلاعات شخصی</SectionLabel>
            <Card className="divide-y divide-line p-0">
              <InfoRow
                icon={<Mail className="size-4" strokeWidth={1.6} />}
                label="ایمیل"
                value={user.email ?? "—"}
              />
              <InfoRow
                icon={<Globe className="size-4" strokeWidth={1.6} />}
                label="منطقه زمانی"
                value={data?.timezone ?? "Asia/Tehran"}
              />
            </Card>
          </section>

          <section className="space-y-3">
            <SectionLabel>خانه ما</SectionLabel>
            <Card className="divide-y divide-line p-0">
              {householdName ? (
                <LinkRow
                  href="/home"
                  icon={<House className="size-4" strokeWidth={1.6} />}
                  label={householdName}
                  hint={
                    memberCount != null
                      ? `${toPersianNumber(memberCount)} عضو`
                      : undefined
                  }
                />
              ) : (
                <LinkRow
                  href="/home"
                  icon={<House className="size-4" strokeWidth={1.6} />}
                  label="ساخت یا پیوستن به خانه"
                  hint="هنوز عضو خانه‌ای نیستید."
                />
              )}
              <LinkRow
                href="/home"
                icon={<UsersRound className="size-4" strokeWidth={1.6} />}
                label="اعضای خانه"
              />
              <LinkRow
                href="/documents"
                icon={<FileText className="size-4" strokeWidth={1.6} />}
                label="مدارک خانه"
              />
            </Card>
          </section>

          <section className="space-y-3">
            <SectionLabel>ویرایش پروفایل</SectionLabel>
            <ProfileForm
              profile={
                data ?? {
                  full_name: "",
                  timezone: "Asia/Tehran",
                  locale: "fa-IR",
                }
              }
            />
          </section>

          <section className="space-y-3">
            <SectionLabel>تنظیمات</SectionLabel>
            <Card className="divide-y divide-line p-0">
              <LinkRow
                href="/settings"
                icon={<Settings className="size-4" strokeWidth={1.6} />}
                label="تنظیمات حساب کاربری"
                hint="ظاهر، اتصال و ترجیحات"
              />
              <LinkRow
                href="/settings"
                icon={<Bell className="size-4" strokeWidth={1.6} />}
                label="اعلان‌ها و یادآورها"
              />
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
