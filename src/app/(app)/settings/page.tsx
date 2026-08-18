import { NotificationCapability } from "@/features/reminders/components/notification-capability";
import { ReminderPreferencesForm } from "@/features/reminders/components/reminder-preferences-form";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">تنظیمات</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          ترجیحات یادآور، اعلان‌ها و رفتارهای fallback در این بخش مدیریت
          می‌شوند.
        </p>
      </section>

      <ReminderPreferencesForm />
      <NotificationCapability />

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
