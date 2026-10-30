import Link from "next/link";
import { NotificationCapability } from "@/features/reminders/components/notification-capability";
import { PushSubscriptionCard } from "@/features/reminders/components/push-subscription-card";
import { ReminderPreferencesForm } from "@/features/reminders/components/reminder-preferences-form";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { ThemeToggle } from "@/shared/layout/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">تنظیمات</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          تم، ترجیحات یادآور، اعلان‌ها و دسترسی‌های خانه در این بخش مدیریت
          می‌شوند.
        </p>
      </section>

      <Card className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>ظاهر برنامه</CardTitle>
          <CardDescription>
            بین حالت روشن، تاریک و هماهنگ با سیستم جابه‌جا شوید.
          </CardDescription>
        </div>
        <ThemeToggle />
      </Card>

      <PushSubscriptionCard />
      <ReminderPreferencesForm />
      <NotificationCapability />

      <Link
        href="/reminders"
        className="block rounded-3xl border border-zinc-200 bg-white p-4 text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
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
          className="inline-flex text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
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
            className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            دریافت داده‌ها (JSON)
          </a>
          <a
            href="/api/export?format=csv"
            download
            className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
