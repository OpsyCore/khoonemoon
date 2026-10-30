import { PageHeader } from "@/shared/ui/page-header";
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
    <div className="space-y-4">
      <PageHeader
        title="پروفایل"
        subtitle="اطلاعات حساب، منطقه زمانی و زبان پیش‌فرض خود را مدیریت کنید."
        decor
      />

      <Link
        href="/documents"
        className="block rounded-card border border-line bg-card p-4 text-sm font-medium text-olive-ink shadow-paper hover:bg-sunken"
      >
        مدارک خانه ←
      </Link>

      <Link
        href="/settings"
        className="block rounded-card border border-line bg-card p-4 text-sm font-medium text-olive-ink shadow-paper hover:bg-sunken"
      >
        تنظیمات و اعلان‌ها ←
      </Link>
      <Link
        href="/search"
        className="block rounded-card border border-line bg-card p-4 text-sm font-medium text-olive-ink shadow-paper hover:bg-sunken"
      >
        جستجو ←
      </Link>

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
