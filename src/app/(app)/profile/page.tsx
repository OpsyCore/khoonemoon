import { Settings } from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { PageHeader } from "@/shared/ui/page-header";

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
        kicker="حساب من"
        title="پروفایل"
        subtitle="اطلاعات حساب، منطقه زمانی و زبان پیش‌فرض شما."
        action={
          <Link
            href="/settings"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 text-[13px] font-medium text-ink transition hover:bg-sunken"
          >
            <Settings className="size-3.5" strokeWidth={1.75} />
            تنظیمات
          </Link>
        }
      />

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
        <ProfileForm
          profile={
            data ?? {
              full_name: "",
              timezone: "Asia/Tehran",
              locale: "fa-IR",
            }
          }
        />
      ) : null}
    </div>
  );
}
