# DEPLOYMENT.md

راهنمای استقرار، پیکربندی و بازیابی «خونه‌مون». هر بخش دستورهای دقیق دارد؛
هیچ‌جا «مطمئن شوید متغیرها درست است» نوشته نشده، چون این‌طور جمله هیچ کاری نمی‌کند.

---

## ۱. پیش‌نیازها

| مورد | چرا لازم است |
| --- | --- |
| پروژهٔ Supabase | دیتابیس، احراز هویت و Realtime |
| میزبان Next.js (Vercel / Netlify / VPS) | اجرای اپ |
| دامنهٔ HTTPS | PWA و Web Push بدون `https` کار نمی‌کنند |

مخزن: <https://github.com/OpsyCore/khoonemoon>
پروژهٔ Supabase تولید: `isfzuxrkzeeeggvfcoah`

---

## ۲. متغیرهای محیطی

### حداقل لازم برای بالا آمدن سایت

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_APP_URL=https://<domain>
```

بدون این سه، اپ بالا می‌آید ولی ورود و داده کار نمی‌کند.

### اختیاری ولی لازم برای قابلیت‌های مشخص

| متغیر | قابلیت | اگر نباشد چه می‌شود |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | ارسال زمان‌بندی‌شدهٔ یادآور برای **همهٔ** کاربران | فقط یادآورهای کاربر جاری پردازش می‌شود؛ `/api/reminders/dispatch` در حالت cron خطای ۵۰۰ می‌دهد |
| `CRON_SECRET` | احراز هویت زمان‌بند | زمان‌بند نمی‌تواند endpoint را صدا بزند (۴۰۱) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push | فقط یادآور درون‌برنامه‌ای؛ در تنظیمات پیام «کلید VAPID تنظیم نشده» |
| `VAPID_PRIVATE_KEY` | امضای push | همان بالا |
| `VAPID_SUBJECT` | تماس سرویس push | همان بالا |
| `DATABASE_URL` | بررسی اتصال مستقیم در `/api/health` | `/api/health` فقط وضعیت Supabase را می‌سنجد |

> `SUPABASE_SERVICE_ROLE_KEY` کلید حساس است: فقط در متغیرهای محیطی میزبان، هرگز
> در کلاینت و هرگز در `NEXT_PUBLIC_*`.

### بررسی سریع پس از تنظیم

```bash
npm run deploy:check          # فقط وجود و شکل متغیرها را بررسی می‌کند، مقدار را چاپ نمی‌کند
curl -s https://<domain>/api/health | jq
```

`/api/health` باید `200` با `{ "ok": true }` بدهد. اگر `503` داد یعنی اتصال
Supabase برقرار نیست.

---

## ۳. پیکربندی Supabase

1. **مهاجرت‌ها**: فایل‌های `drizzle/0001…0010` به ترتیب روی دیتابیس اجرا می‌شوند.
   ```bash
   psql "$DATABASE_URL" -f drizzle/0001_....sql   # و به همین ترتیب
   ```
   یا در CI: job «Migrations · RLS» همین کار را روی Postgres تازه انجام می‌دهد.

2. **آدرس‌ها**: در Authentication → URL Configuration
   - `Site URL`: دامنهٔ تولید
   - `Redirect URLs`: `https://<domain>/**` و برای توسعه `http://localhost:3000/**`

3. **کلیدهای API**: `anon` برای کلاینت، `service_role` فقط برای سرور.

---

## ۴. زمان‌بندی یادآورها

بدون این بخش، یادآورها و Web Push فقط با فراخوانی دستی کار می‌کنند.

```bash
gh variable set APP_BASE_URL --body "https://<domain>"
gh secret set CRON_SECRET --body "$(openssl rand -hex 32)"
```

همان مقدار `CRON_SECRET` را در متغیرهای محیطی اپ هم بگذارید. سپس:

```bash
gh workflow run reminder-dispatch      # اجرای آزمایشی
gh run list --workflow=reminder-dispatch --limit 3
```

- زمان‌بندی: هر ۱۵ دقیقه (`.github/workflows/reminder-dispatch.yml`)
- اجرای دستی برای preview: `gh workflow run reminder-dispatch -f base_url=https://preview.example.com`
- اگر `APP_BASE_URL` یا `CRON_SECRET` تنظیم نشده باشد، workflow سبز می‌ماند و
  هشدار می‌دهد؛ یادآوری گم نمی‌شود، فقط ارسال نمی‌شود.

---

## ۵. نسخهٔ پشتیبان

دو لایه، هر دو لازم:

### الف) PITR / نسخهٔ خودکار Supabase

Supabase در پلن‌های دارای backup، نسخهٔ روزانه نگه می‌دارد و امکان Point-in-Time
Recovery دارد. آن را از داشبورد → Database → Backups بررسی کنید و بدانید پنجرهٔ
بازیابی چند ساعت است. **بدون تمرین، عدد پنجره فقط یک امید است.**

### ب) نسخهٔ دستی با `pg_dump`

```bash
pg_dump "$DATABASE_URL" \
  --schema=public --schema=auth \
  --no-owner --no-privileges \
  -Fc -f "backup-$(date +%F-%H%M).dump"
```

بازگردانی:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$RESTORE_TARGET" backup-2026-10-29-1200.dump
```

> ترتیب مهم است: `auth.users` پیش از جدول‌های دامنه. اگر جدول‌های دامنه را بدون
> کاربرانشان بازگردانید، اولین کلید خارجی می‌شکند. این را تمرین زیر پیدا کرد.

---

## ۶. تمرین بازگردانی (بدون دیتابیس تولید)

```bash
npm run drill:restore
```

این اسکریپت واقعاً چرخهٔ کامل را انجام می‌دهد:

1. پایگاه را از مهاجرت‌ها می‌سازد (PGlite، بدون نیاز به سرور)
2. داده‌ی نمونه درج می‌کند
3. از هر جدول نسخهٔ JSON می‌گیرد
4. پایگاه دومِ خالی از همان مهاجرت‌ها می‌سازد
5. نسخه را با ترتیب درست کلیدهای خارجی بازمی‌گرداند
6. **ردیف‌به‌ردیف و ستون‌به‌ستون مقایسه می‌کند**

خروجی موفق:

```text
✔ تمرین بازگردانی موفق بود: 5 ردیف در 9 جدول، 51 مقدار مقایسه شد و همه یکسان بودند.
```

این تمرین نسخهٔ سطح برنامه را می‌سنجد، نه فایل واقعی `pg_dump`. برای تمرین کامل:

1. یک دیتابیس خالی Postgres بسازید (یا یک Supabase branch).
2. `pg_restore` بزنید.
3. `npm run db:verify` را روی دیتابیس بازگردانده‌شده اجرا کنید — مهاجرت‌ها،
   GRANTها و RLS باید از نو پاس شوند.
4. یک ورود واقعی در اپ انجام دهید تا مطمئن شوید `auth.users` هم سالم است.

---

## ۷. انتشار و بازگردانی نسخه

```bash
npm run verify && npm run build && npm run budget   # همان گیت‌های CI
```

- **Vercel**: هر push به `main` منتشر می‌شود؛ rollback از تب Deployments.
- **Netlify**: همان، با Deploys → «Publish deploy» روی نسخهٔ سالم قبلی.
- **VPS**: تصویر قبلی را نگه دارید؛ برگشت یعنی اجرای دوبارهٔ همان image.

مهاجرت‌ها **فقط به جلو** نوشته شده‌اند (`create table if not exists`,
`create or replace`). برای تغییر ساختار در آینده: مهاجرت جدید بنویسید، مهاجرت
قدیمی را ویرایش نکنید.

---

## ۸. چک‌لیست قبل از اعلام «آماده»

- [ ] `/api/health` → `200`
- [ ] ثبت‌نام و ورود با ایمیل واقعی
- [ ] ساخت خانه، دعوت نفر دوم، پذیرش دعوت
- [ ] افزودن خرید/تسک/قبض/کار خانه از شیت «افزودن سریع»
- [ ] `gh workflow run reminder-dispatch` → سبز و پیام push روی دستگاه واقعی
- [ ] `npm run drill:restore` → سبز
- [ ] `npm run budget` → سبز
- [ ] یک بار خروج و ورود مجدد روی موبایل (PWA نصب‌شده)
