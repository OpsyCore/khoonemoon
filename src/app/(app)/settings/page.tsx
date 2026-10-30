import { LogoutButton } from "@/features/auth/components/logout-button";
import { PageHeader } from "@/shared/ui/page-header";
import Link from "next/link";
import { NotificationCapability } from "@/features/reminders/components/notification-capability";
import { PushSubscriptionCard } from "@/features/reminders/components/push-subscription-card";
import { ReminderPreferencesForm } from "@/features/reminders/components/reminder-preferences-form";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { ThemeToggle } from "@/shared/layout/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="تنظیمات"
        subtitle="تم، ترجیحات یادآور، اعلان‌ها و دسترسی‌های خانه در این بخش مدیریت می‌شوند."
        decor
      />

      <Card className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>ظاهر برنامه</CardTitle>
          <CardDescription>بین حالت روشن و تاریک جابه‌جا شوید.</CardDescription>
        </div>
        <ThemeToggle />
      </Card>

      <PushSubscriptionCard />
      <ReminderPreferencesForm />
      <NotificationCapability />

      <Link
        href="/reminders"
        className="block rounded-3xl border border-line bg-card p-4 text-sm font-medium text-olive-ink shadow-paper transition hover:bg-sunken"
      >
        صندوق یادآورها — همهٔ یادآورها، از جمله تحویل‌شده و لغو‌شده
      </Link>

      <Card className="space-y-2">
        <CardTitle>خانه و اعضا</CardTitle>
        <CardDescription>
          ساخت خانه، دعوت شریک و مدیریت دسترسی‌ها در صفحه «خونه» انجام می‌شود.
        </CardDescription>
        <Link
          href="/home"
          className="inline-flex text-sm font-medium text-olive-ink hover:underline"
        >
          رفتن به صفحه خانه
        </Link>
      </Card>

      <Card className="space-y-3">
        <CardTitle>خروجی گرفتن از داده‌ها</CardTitle>
        <CardDescription>
          فایل JSON شامل گزیده‌ای از داده‌های قابل مشاهدهٔ حساب شماست؛ فایل‌های
          مدارک و همهٔ جزئیات را شامل نمی‌شود و ممکن است تعداد رکوردها محدود
          باشد. فایل CSV فقط تراکنش‌های مالی را برای باز کردن در اکسل می‌دهد.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export"
            download
            className="rounded-2xl border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-sunken"
          >
            دریافت داده‌ها (JSON)
          </a>
          <a
            href="/api/export?format=csv"
            download
            className="rounded-2xl border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-sunken"
          >
            تراکنش‌های مالی (CSV)
          </a>
        </div>
      </Card>

      <Card className="space-y-2">
        <CardTitle>نصب روی گوشی (PWA)</CardTitle>
        <CardDescription>
          در مرورگر موبایل از منوی مرورگر گزینه «افزودن به صفحه اصلی» را انتخاب
          کنید تا برنامه مانند یک اپ نصب شود. صفحه «امروز» به‌صورت آفلاین کش
          نمی‌شود تا داده خصوصی خانه روی دستگاه مشترک باقی نماند؛ فقط پوسته
          عمومی برنامه و صفحه راهنمای آفلاین در دسترس‌اند.
        </CardDescription>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <CardTitle>حساب کاربری</CardTitle>
        <LogoutButton showLabel />
      </Card>

      <Card>
        <CardTitle>محدودیت‌های پلتفرم وب</CardTitle>
        <CardDescription>
          یادآورهای ذخیره‌شده در دیتابیس منبع اصلی حقیقت هستند و برای اپ‌های
          Android/iOS آینده قابل استفاده‌اند. در PWA/Browser، اعلان دقیق
          پس‌زمینه همیشه تضمین‌شده نیست؛ بنابراین همیشه fallback درون‌برنامه‌ای
          فعال است.
        </CardDescription>
      </Card>
    </div>
  );
}
