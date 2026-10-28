# خونه‌مون (Khoonemoon)

سیستم زندگی مشترک برای زوج‌ها — موبایل‌محور، فارسی، RTL و قابل نصب به‌عنوان PWA.

ساخته‌شده با **Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth / Postgres / RLS / Realtime) + Zod**.

---

## وضعیت فعلی

| Milestone | موضوع                          | وضعیت       |
| --------- | ------------------------------ | ----------- |
| M1        | Foundation UI/RTL/PWA/theme    | ✅          |
| M2        | Auth + Profile                 | ✅          |
| M3        | Household + Invitations + RLS  | ✅          |
| M4        | Tasks + Recurrence             | ✅          |
| M5        | Today + Calendar (Jalali)      | ✅          |
| M6        | Reminders + Notification prefs | ✅          |
| M7        | Chores + Rotation              | ✅          |
| M8        | Shopping + Realtime            | ✅          |
| M9        | Finance Lite (bills)           | ✅          |
| M10       | Search + Settings              | ✅          |
| M11       | Hardening (test/CI/docs)       | 🚧 در جریان |

جزئیات در [`FEATURES.md`](./FEATURES.md) و [`TODO.md`](./TODO.md).

## قابلیت‌های اصلی

- **امروز**: تسک‌های معوق/امروز، رویدادهای هفت‌روز آینده، قبض‌های سررسید، کارهای خانه امروز و یادآورهای نزدیک
- **تقویم**: نمای ماه/هفته/فهرست با تاریخ شمسی و تجمیع تسک + رویداد
- **خانه**: ساخت خانه، دعوت شریک با کد یک‌بارمصرف، نقش مالک/عضو، خروج از خانه
- **لیست‌ها**: سه تب — خرید مشترک (هم‌زمان‌سازی زنده)، کارهای خانه (نوبت‌بندی چرخشی)، مالی (قبض/هزینه/درآمد)
- **جستجو**: جستجوی یکپارچه در تسک، رویداد، خرید، مالی و کارهای خانه — همیشه فیلترشده با RLS
- **تنظیمات**: تم، ترجیحات یادآور، وضعیت پشتیبانی اعلان، راهنمای نصب PWA
- **امنیت**: RLS روی همه جداول کاربر، mutationهای حساس از طریق RPCهای `security definer`

## پیش‌نیاز

- Node.js 22+
- یک پروژه Supabase (Postgres 15+)

## راه‌اندازی

```bash
npm install
cp .env.example .env.local   # مقادیر Supabase را پر کنید
npm run dev
```

### ۱) متغیرهای محیطی

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# اختیاری: فقط برای health check مستقیم و ابزارهای سرور
DATABASE_URL=

# فقط برای اسکریپت smoke test سمت اپراتور (هرگز در کلاینت نگذارید)
SUPABASE_SERVICE_ROLE_KEY=
```

### ۲) اعمال مهاجرت‌ها

همه‌ی schema، RLS و RPCها در `drizzle/*.sql` هستند و باید **به ترتیب شماره** اجرا شوند:

```bash
# از داشبورد Supabase → SQL Editor، هر فایل را به ترتیب اجرا کنید
# یا با psql:
for f in drizzle/000*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

مهاجرت‌ها idempotent هستند (اجرای دوباره خطا نمی‌دهد).

### ۳) تنظیمات Auth در Supabase

- **Site URL**: دامنه اپ (مثلاً `https://khoonemoon.netlify.app`)
- **Redirect URLs**: `http://localhost:3000/**`, `<د‌امنه>/**`
- برای تجربه توسعه بدون ایمیل تأیید: `Confirm email` را خاموش کنید.

## اسکریپت‌ها

| اسکریپت          | کار                                                                              |
| ---------------- | -------------------------------------------------------------------------------- |
| `npm run dev`    | اجرای محیط توسعه                                                                 |
| `npm run build`  | بیلد پروداکشن                                                                    |
| `npm run verify` | typecheck + lint + test (همان چیزی که CI اجرا می‌کند)                            |
| `npm test`       | تست‌های واحد (Vitest)                                                            |
| `npm run smoke`  | تست دود end-to-end روی یک محیط در حال اجرا (نیازمند `SUPABASE_SERVICE_ROLE_KEY`) |

### تست دود (smoke)

```bash
APP_URL=http://localhost:3000 npm run smoke
```

این اسکریپت دو کاربر آزمایشی می‌سازد، خانه می‌سازد، خرید/کار خانه/قبض را می‌آزماید،
RLS را از دید یک کاربر بیرونی بررسی می‌کند و در پایان کاربران تست را پاک می‌کند.

## ساختار پروژه

```text
src/
  app/            # App Router: صفحات، route handlerها، manifest، offline
  features/       # ماژول‌های دامنه (auth, households, tasks, calendar, reminders, chores, shopping, finance, search)
  db/             # schema برای مرجع Drizzle (اجرای داده واقعی با Supabase است)
  lib/            # کلاینت‌های Supabase، گاردهای API
  shared/         # UI primitives، layout، providers، utils (Jalali، locale)
drizzle/          # مهاجرت‌های SQL منبع حقیقت (schema + RLS + RPC + grants)
public/           # manifest icons، service worker
scripts/          # ابزارهای اپراتوری (smoke test)
```

جزئیات معماری در [`ARCHITECTURE.md`](./ARCHITECTURE.md)، مدل داده و RLS در
[`DATABASE.md`](./DATABASE.md) و [`SECURITY.md`](./SECURITY.md).

## استقرار

1. مخزن را به Vercel (یا هر میزبان Next.js) وصل کنید.
2. متغیرهای محیطی بالا را تنظیم کنید (`NEXT_PUBLIC_*` فقط در کلاینت در دسترس‌اند).
3. آدرس دامنه را در Supabase → Authentication → URL Configuration اضافه کنید.
4. `/api/health` وضعیت Supabase و (در صورت تنظیم) اتصال مستقیم DB را برمی‌گرداند.
