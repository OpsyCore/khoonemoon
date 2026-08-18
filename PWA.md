# PWA.md

## 1) هدف PWA

- تجربه نزدیک به اپ native روی موبایل
- installability
- دسترسی حداقلی در وضعیت آفلاین
- آماده‌سازی برای اعلان‌های push در فاز مناسب

## 2) وضعیت فعلی

- هنوز manifest/service worker/offline route پیاده‌سازی نشده است.

## 3) رویکرد پیشنهادی

### Installability

- استفاده از `app/manifest.ts`
- آیکن‌ها در `public/icons`
- theme/background colors همسو با light/dark

### Service Worker

- گزینه اول: **Serwist** (`@serwist/next`) به‌عنوان مسیر نگهداری بلندمدت
- گزینه دوم: `@ducanh2912/next-pwa` (فعال اما قدیمی‌تر)

تصمیم پیشنهادی: اگر سازگاری سریع با Next نسخه فعلی تایید شد، Serwist انتخاب شود. در غیر این‌صورت موقتاً @ducanh2912/next-pwa با migration plan به Serwist.

### Offline Strategy (MVP)

1. app shell caching
2. static assets caching
3. offline fallback page
4. نشان دادن وضعیت offline/online به کاربر
5. جلوگیری از ادعای sync تضمینی در background

## 4) Notification Strategy

انواع اعلان:

1. in-app reminders
2. browser/PWA notifications
3. server-triggered web push
4. future native push

در MVP:

- مدل داده reminders + subscription + preferences پیاده‌سازی می‌شود
- درخواست permission فقط پس از اقدام کاربر (نه هنگام first-load)
- graceful fallback اگر مرورگر push را پشتیبانی نکند

## 5) محدودیت‌های واقعی پلتفرم

- browser alarms زمان‌بندی دقیق background را تضمین نمی‌کند
- رفتار iOS PWA برای push وابسته به نسخه OS و install state است
- offline mutations پیچیده در MVP محدود و شفاف اعلام می‌شود

## 6) معیار پذیرش MVP PWA

- manifest معتبر
- prompt install در مرورگرهای پشتیبان
- offline route قابل‌دسترسی هنگام قطع اینترنت
- assets اصلی از cache سرو شوند
- UI وضعیت اتصال را نشان دهد

## 7) برنامه تست PWA

- Lighthouse PWA checks
- تست دستی Android Chrome
- تست دستی iOS Safari/PWA
- تست fallback وقتی network قطع است
