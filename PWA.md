# PWA.md

## 1) هدف PWA

- تجربه نزدیک به اپ native روی موبایل
- installability
- دسترسی حداقلی در وضعیت آفلاین
- آماده‌سازی برای اعلان‌های push در فاز مناسب

## 2) وضعیت فعلی

پیاده‌سازی شده در Milestone 1 و در Milestone 10 بازبینی امنیتی شد:

- `src/app/manifest.ts` — manifest معتبر، `lang=fa-IR`، `dir=rtl`، آیکن‌های ۱۹۲/۵۱۲
- `public/sw.js` — استراتژی «پوسته عمومی»:
  - precache: `/offline`، manifest و آیکن‌ها
  - assetهای `/_next/static` و آیکن‌ها: cache-first
  - ناوبری‌ها: network-first با fallback به صفحه آفلاین
  - **هیچ صفحه احراز هویت‌شده‌ای (مثل `/today`) و هیچ درخواست `/api/*` یا Supabase کش نمی‌شود**
- `src/app/offline/page.tsx` — صفحه fallback
- `src/shared/layout/connection-status.tsx` — نمایش وضعیت آنلاین/آفلاین
- `src/shared/providers/pwa-provider.tsx` — ثبت service worker

> نکته امنیتی: نسخه قبلی service worker صفحه `/today` را precache می‌کرد؛ چون آن
> صفحه داده خصوصی خانه را نشان می‌دهد، این کار روی دستگاه مشترک باعث نشت داده
> می‌شد. اکنون کش فقط شامل دارایی‌های عمومی است.

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

- manifest معتبر ✅
- قابلیت نصب روی موبایل ✅
- صفحه آفلاین در دسترس ✅
- عدم کش‌شدن داده خصوصی ✅
- ثبت service worker فقط در محیط‌های امن (https/localhost) ✅

## 7) برنامه تست PWA

- Lighthouse PWA checks
- تست دستی Android Chrome
- تست دستی iOS Safari/PWA
- تست fallback وقتی network قطع است
