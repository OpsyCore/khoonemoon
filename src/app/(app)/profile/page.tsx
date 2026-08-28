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
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">پروفایل</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          اطلاعات حساب، منطقه زمانی و زبان پیش‌فرض خود را مدیریت کنید. تنظیمات
          ظاهر، اتصال و یادآور در{" "}
          <Link href="/settings" className="text-sky-700 dark:text-sky-300">
            تنظیمات
          </Link>{" "}
          است.
        </p>
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
