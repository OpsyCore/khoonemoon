# PWA.md

## 1) هدف PWA

- تجربه نزدیک به اپ native روی موبایل
- installability
- دسترسی حداقلی در وضعیت آفلاین
- آماده‌سازی برای اعلان‌های push در فاز مناسب

## 2) وضعیت فعلی (M10)

- `src/app/manifest.ts` → `/manifest.webmanifest`
- آیکن‌ها در `public/icons`
- Service Worker: `public/sw.js` (`khunemun-shell-v3`، ثبت در `PwaProvider`)
- Offline fallback: `/offline` با تلاش مجدد بر اساس `navigator.onLine`
- نشان وضعیت اتصال در نوار بالا و صفحه تنظیمات

## 3) Offline Strategy (MVP)

1. app shell / navigate: network-first، سپس cache، سپس `/offline`
2. `/api/*` intercept نمی‌شود (network-only؛ پاسخ authenticated در SW cache نمی‌شود)
3. static GET: cache-first سپس network
4. نشان دادن وضعیت offline/online به کاربر
5. جلوگیری از ادعای sync تضمینی در background
6. صف mutation آفلاین ساخته نشده؛ منبع حقیقت همچنان Supabase است

## 4) Notification Strategy

در MVP:

- مدل داده reminders + preferences پیاده‌سازی شده
- درخواست permission فقط پس از اقدام کاربر
- graceful fallback اگر مرورگر push را پشتیبانی نکند

## 5) محدودیت‌های واقعی پلتفرم

- browser alarms زمان‌بندی دقیق background را تضمین نمی‌کند
- رفتار iOS PWA برای push وابسته به نسخه OS و install state است
- offline mutations پیچیده در MVP وجود ندارد

## 6) معیار پذیرش MVP PWA

- manifest معتبر
- offline route قابل‌دسترسی هنگام قطع اینترنت
- UI وضعیت اتصال را نشان دهد
- retry به `/today` فقط وقتی آنلاین است
