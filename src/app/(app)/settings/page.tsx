import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { NotificationCapability } from "@/features/reminders/components/notification-capability";
import { ReminderPreferencesForm } from "@/features/reminders/components/reminder-preferences-form";
import { AccountSettingsCard } from "@/features/settings/components/account-card";
import { AppearanceSettingsCard } from "@/features/settings/components/appearance-card";
import { ConnectionSettingsCard } from "@/features/settings/components/connection-card";
import { SettingsShortcutsCard } from "@/features/settings/components/shortcuts-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { SectionLabel } from "@/shared/ui/section-label";
import { ErrorState } from "@/shared/ui/error-state";
import { PageHeader } from "@/shared/ui/page-header";

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
    <div className="space-y-7">
      <div className="space-y-4">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition hover:text-ink"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.75} />
          بازگشت به پروفایل
        </Link>
        <PageHeader
          kicker="سلیقه ما"
          title="تنظیمات"
          subtitle="حساب، ظاهر، اتصال، یادآورها و اعلان‌ها."
        />
      </div>

      <section className="space-y-3">
        <SectionLabel>حساب و پروفایل</SectionLabel>
        <AccountSettingsCard email={user.email ?? null} />
      </section>

      <section className="space-y-3">
        <SectionLabel>ظاهر دفترچه</SectionLabel>
        <AppearanceSettingsCard />
      </section>

      <section className="space-y-3">
        <SectionLabel>یادآورها و اعلان‌ها</SectionLabel>
        <ReminderPreferencesForm />
        <NotificationCapability />
      </section>

      <section className="space-y-3">
        <SectionLabel>اتصال و نصب</SectionLabel>
        <ConnectionSettingsCard />
        <Card className="p-5">
          <CardTitle>آفلاین و نصب</CardTitle>
          <CardDescription>
            صفحهٔ آفلاین و Service Worker موجود هستند. همگام‌سازی آفلاین جداگانه
            و صف mutation خارج از معماری فعلی ساخته نشده است. نصب PWA از منوی
            مرورگر انجام می‌شود.
          </CardDescription>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionLabel>میانبرها</SectionLabel>
        <SettingsShortcutsCard />
      </section>
    </div>
  );
}
