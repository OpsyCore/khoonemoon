import Link from "next/link";
import { NotificationCapability } from "@/features/reminders/components/notification-capability";
import { ReminderPreferencesForm } from "@/features/reminders/components/reminder-preferences-form";
import { AccountSettingsCard } from "@/features/settings/components/account-card";
import { AppearanceSettingsCard } from "@/features/settings/components/appearance-card";
import { ConnectionSettingsCard } from "@/features/settings/components/connection-card";
import { SettingsShortcutsCard } from "@/features/settings/components/shortcuts-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مشاهده تنظیمات باید وارد حساب شوید."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/profile" className="font-medium text-sky-700 dark:text-sky-300">
          پروفایل
        </Link>
        <span> / تنظیمات</span>
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">تنظیمات</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          حساب، ظاهر، اتصال، یادآور و اعلان‌ها در همین صفحه مدیریت می‌شوند.
        </p>
      </section>

      <AccountSettingsCard email={user.email ?? null} />
      <AppearanceSettingsCard />
      <ConnectionSettingsCard />
      <ReminderPreferencesForm />
      <NotificationCapability />
      <SettingsShortcutsCard />

      <Card>
        <CardTitle>آفلاین و نصب</CardTitle>
        <CardDescription>
          صفحهٔ آفلاین و Service Worker موجود هستند. همگام‌سازی آفلاین جداگانه
          و صف mutation خارج از معماری فعلی ساخته نشده است. نصب PWA از منوی
          مرورگر انجام می‌شود.
        </CardDescription>
      </Card>
    </div>
  );
}
