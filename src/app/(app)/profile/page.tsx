import { HeaderIconLink, PageHeader } from "@/shared/ui/page-header";
import { Settings, FileText, Search, House } from "lucide-react";
import { BranchDecor, TapeStrip } from "@/shared/ui/decor";
import { Card } from "@/shared/ui/card";
import { SectionLabel } from "@/shared/ui/section-label";
import Link from "next/link";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

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

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, timezone, locale")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-7">
      <PageHeader
        title="پروفایل"
        subtitle="حساب شما در دفترچه‌ی مشترک."
        action={
          <HeaderIconLink href="/settings" label="تنظیمات">
            <Settings className="size-[18px]" />
          </HeaderIconLink>
        }
      />

      <section className="relative flex flex-col items-center gap-2 pt-2 text-center">
        <BranchDecor className="pointer-events-none absolute -top-1 right-[calc(50%+2.25rem)] h-10 w-20 opacity-30" />
        <BranchDecor className="pointer-events-none absolute -top-1 left-[calc(50%+2.25rem)] h-10 w-20 -scale-x-100 opacity-30" />
        <div className="relative">
          <TapeStrip className="absolute -top-3 left-1/2 h-4 w-16 -translate-x-1/2" />
          <span className="flex size-20 items-center justify-center rounded-full border-2 border-card bg-clay-soft text-2xl font-bold text-clay-ink shadow-paper">
            {(data?.full_name?.trim() || user.email || "؟").slice(0, 1)}
          </span>
        </div>
        <p className="pt-1 text-lg font-bold text-ink">
          {data?.full_name?.trim() || "بدون نام"}
        </p>
        <p dir="ltr" className="text-xs text-muted">
          {user.email}
        </p>
      </section>
      <section className="space-y-3">
        <SectionLabel>خانه و تنظیمات</SectionLabel>
        <Card className="divide-y divide-line p-0">
          {[
            { href: "/home", label: "خانه و اعضا", Icon: House },
            { href: "/documents", label: "مدارک خانه", Icon: FileText },
            { href: "/settings", label: "تنظیمات و اعلان‌ها", Icon: Settings },
            { href: "/search", label: "جستجو", Icon: Search },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 text-sm text-ink transition hover:bg-sunken"
            >
              <span className="rounded-full bg-olive-soft p-2 text-olive-ink">
                <Icon className="size-4" />
              </span>
              <span className="flex-1">{label}</span>
              <span aria-hidden="true" className="text-muted">
                ‹
              </span>
            </Link>
          ))}
        </Card>
      </section>

      {error ? (
        <ErrorState
          title="خطا در دریافت پروفایل"
          description="لطفاً دوباره تلاش کنید."
        />
      ) : null}

      {!error && !data ? (
        <EmptyState
          title="پروفایل اولیه"
          description="لطفاً اطلاعات اولیه را تکمیل و ذخیره کنید."
        />
      ) : null}

      {!error ? (
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
      ) : null}
    </div>
  );
}
