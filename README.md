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

| اسکریپت                 | کار                                                                              |
| ----------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`           | اجرای محیط توسعه                                                                 |
| `npm run build`         | بیلد پروداکشن                                                                    |
| `npm run verify`        | typecheck + lint + test (همان چیزی که CI اجرا می‌کند)                            |
| `npm test`              | تست‌های واحد (Vitest)                                                            |
| `npm run smoke`         | تست دود end-to-end روی یک محیط در حال اجرا (نیازمند `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run budget`        | سنجش حجم JS هر مسیر روی خروجی واقعی build و مقایسه با `bundle-budget.json`       |
| `npm run deploy:check`  | بررسی متغیرهای محیطی استقرار (بدون چاپ مقدار کلیدها)                             |
| `npm run drill:restore` | تمرین واقعی پشتیبان‌گیری و بازگردانی روی PGlite                                  |
| `npm run e2e:http`      | بالا آوردن build واقعی و بررسی صفحه‌ها، هدایت و گاردهای API (بدون مرورگر)        |
| `npm run dev:public`    | اجرای dev روی `0.0.0.0:3000` برای پیش‌نمایش Codespaces                           |

### بودجهٔ باندل

```bash
npm run build && npm run budget
```

خروجی، حجم gzip جاوااسکریپت هر مسیر را از مانیفست‌های واقعی build می‌خواند
(نه تخمین) و با سقف‌های `bundle-budget.json` مقایسه می‌کند:

```text
• /today                   211.8 KB  از 234.4 KB
• /lists                   114.3 KB  از 234.4 KB
• shared (هر صفحه)         128.9 KB  از 141.6 KB
```

اگر مسیری از سقفش بگذرد، اسکریپت با کد خطا خارج می‌شود و **CI قرمز می‌شود**.
دو راه‌حل: import اضافه را حذف کنید، یا اگر رشد آگاهانه و موجه است سقف را در
`bundle-budget.json` به‌روز کنید (تغییر سقف در PR دیده می‌شود، پس پنهانی نیست).

برای یک مسیر خاص می‌توانید سقف جدا بگذارید:

```json
{
  "defaultMaxGzipBytes": 240000,
  "sharedMaxGzipBytes": 145000,
  "routes": { "/today": { "maxGzipBytes": 260000 } }
}
```

### تست دود (smoke)

```bash
APP_URL=http://localhost:3000 npm run smoke
```

این اسکریپت دو کاربر آزمایشی می‌سازد، خانه می‌سازد، خرید/کار خانه/قبض را می‌آزماید،
RLS را از دید یک کاربر بیرونی بررسی می‌کند و در پایان کاربران تست را پاک می‌کند.

### بررسی مهاجرت‌ها و RLS به‌صورت محلی

دو باگ واقعی (ترتیب تعریف تابع و نبود `grant`) فقط با اجرای مهاجرت‌ها روی یک دیتابیس خالی
پیدا می‌شوند؛ برای اینکه دوباره تکرار نشوند یک تست دیتابیس داریم:

سریع‌ترین حالت (بدون نصب Postgres):

```bash
npm run db:check
```

با Postgres واقعی (همان مسیر CI):

```bash
createdb khoonemoon_check
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/khoonemoon_check npm run db:verify
```

این اسکریپت:

1. `db/local/00_auth_shim.sql` را اجرا می‌کند (بازسازی حداقلی `auth.users` و `auth.uid()` برای Postgres معمولی)
2. همه‌ی `drizzle/*.sql` را اعمال می‌کند
3. **یک‌بار دیگر** اعمال می‌کند تا idempotent بودن تضمین شود
4. assertionهای `db/local/10_assertions.sql` را اجرا می‌کند: ایزولیشن خانه‌ها،
   مخفی‌ماندن رکورد خصوصی، نبود دسترسی کاربر بیرونی، دسترسی‌های جدول، چرخش نوبت
   کار خانه، وضعیت قبض و constraintها

> ⚠️ فایل `db/local/00_auth_shim.sql` فقط برای محیط محلی/CI است و هرگز نباید روی
> پروژه Supabase اجرا شود.

### اعلان‌های Push (Web Push / VAPID)

یادآورها علاوه بر نمایش درون‌برنامه‌ای، روی دستگاه هم به‌صورت اعلان نمایش داده می‌شوند:

```bash
# ساخت جفت‌کلید VAPID (یک‌بار برای هر محیط)
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:you@example.com
```

جریان کار:

1. کاربر در «تنظیمات» روی «فعال‌سازی اعلان» می‌زند → مرورگر اجازه می‌گیرد و
   `push_subscription` در جدول `push_subscriptions` ثبت می‌شود.
2. `/api/reminders/dispatch` یادآورهای سررسیده را تحویل می‌دهد و برای کاربرانی که
   `web_push_enabled` دارند، پیام را به همه دستگاه‌های ثبت‌شده می‌فرستد.
3. اشتراک‌های منقضی (پاسخ 404/410 از سرویس push) خودکار `revoked_at` می‌گیرند.
4. اگر کلید تنظیم نشده باشد، اپ به‌جای خطا فقط یادآور درون‌برنامه‌ای نشان می‌دهد،
   و در تنظیمات پیام «کلید VAPID تنظیم نشده» دیده می‌شود.

> نکته: push در حالت نصب‌شده (PWA) و روی `https`/`localhost` کار می‌کند؛ روی iOS
> نیاز به نصب اپ روی صفحه اصلی دارد.

### زمان‌بندی یادآورها

یادآور و Web Push فقط وقتی کار می‌کنند که چیزی واقعاً endpoint را صدا بزند. این
مخزن یک زمان‌بند آماده دارد که به میزبان وابسته نیست:

`.github/workflows/reminder-dispatch.yml` هر ۱۵ دقیقه اجرا می‌شود و
`scripts/dispatch-reminders.mjs` را با متغیرهای زیر صدا می‌زند:

| نام            | نوع                     | توضیح                                                 |
| -------------- | ----------------------- | ----------------------------------------------------- |
| `APP_BASE_URL` | Repository **variable** | آدرس عمومی اپ، مثلاً `https://khoonemoon.example.com` |
| `CRON_SECRET`  | Repository **secret**   | همان مقدار `CRON_SECRET` در متغیرهای محیطی اپ         |

```bash
# تنظیم یک‌باره
gh variable set APP_BASE_URL --body "https://khoonemoon.example.com"
gh secret set CRON_SECRET --body "$(openssl rand -hex 32)"   # همین مقدار را در اپ هم بگذارید
```

اگر این دو تنظیم نشده باشند، workflow سبز می‌ماند ولی هشدار می‌دهد؛ هیچ یادآوری
گم نمی‌شود، فقط ارسال نمی‌شود. اجرای دستی با آدرس دلخواه (مثلاً preview):

```bash
gh workflow run reminder-dispatch -f base_url=https://preview.example.com
```

همان کار به‌صورت دستی یا در cron میزبان:

```bash
APP_BASE_URL=https://<app> CRON_SECRET=<secret> node scripts/dispatch-reminders.mjs
```

- با هدر cron: همه کاربران پردازش می‌شوند (نیازمند `SUPABASE_SERVICE_ROLE_KEY`)
- بدون هدر و با کوکی نشست: فقط یادآورهای همان کاربر پردازش می‌شود
- ساعات سکوت (quiet hours) یادآور را **حذف نمی‌کند**، به اجرای بعدی موکول می‌کند
- اسکریپت فقط روی پاسخ `2xx` با کد ۰ خارج می‌شود، پس خرابی ارسال به‌صورت
  workflow قرمز دیده می‌شود نه سکوت

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

راهنمای کامل و چک‌لیست انتشار در [`DEPLOYMENT.md`](./DEPLOYMENT.md) است: متغیرهای
محیطی، پیکربندی Supabase، زمان‌بندی یادآورها، نسخهٔ پشتیبان و تمرین بازگردانی.

```bash
npm run deploy:check     # چه چیزی تنظیم نشده؟
npm run drill:restore    # آیا نسخهٔ پشتیبان واقعاً برمی‌گردد؟
```

خلاصهٔ مراحل:

1. مخزن را به Vercel (یا هر میزبان Next.js) وصل کنید.
2. متغیرهای محیطی بالا را تنظیم کنید (`NEXT_PUBLIC_*` فقط در کلاینت در دسترس‌اند).
3. آدرس دامنه را در Supabase → Authentication → URL Configuration اضافه کنید.
4. `/api/health` وضعیت Supabase و (در صورت تنظیم) اتصال مستقیم DB را برمی‌گرداند.
