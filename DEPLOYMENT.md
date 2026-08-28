# DEPLOYMENT.md

وضعیت: **M1–M12 shipped.** پروژهٔ hosted **khoonemoon** (`isfzuxrkzeeeggvfcoah`) ACTIVE_HEALTHY. Two-user interactive QA = NOT EXECUTED.

## محصول

- نام: خونه‌مون
- Next.js App Router `16.2.6` + React `19.2.6` + TypeScript `5.9.3`
- Auth/data: Supabase SSR + RLS (کلاینت authenticated؛ **بدون service role در runtime**)
- Package manager: **npm** (`package.json` scripts؛ pnpm در این ریپو استفاده نمی‌شود)

## متغیرهای محیط

از `.env.example`:

| متغیر | نقش |
| --- | --- |
| `DATABASE_URL` | فقط ابزار Drizzle / مهاجرت دستی؛ runtime صفحات از PostgREST استفاده می‌کند |
| `NEXT_PUBLIC_SUPABASE_URL` | الزامی |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | الزامی؛ کلید عمومی anon |
| `SUPABASE_SERVICE_ROLE_KEY` | اختیاری و **هرگز** به کلاینت |
| `NEXT_PUBLIC_APP_URL` | URL اپ برای redirect احراز هویت |

بدون `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY`، `getSupabaseEnv()` پرتاب می‌کند.

`drizzle.config.json` الان placeholder لوکال است (`127.0.0.1:5432`). برای migrate، URL واقعی را از محیط می‌گیرند؛ در مخزن secret نگذارید.

## مهاجرت‌ها (ترتیب)

اعمال به‌ترتیب روی PostgreSQL/Supabase:

1. `drizzle/0001_milestone2_auth_profiles.sql`
2. `drizzle/0002_milestone3_households.sql`
3. `drizzle/0003_milestone4_tasks.sql`
4. `drizzle/0004_milestone5_events_calendar.sql`
5. `drizzle/0005_milestone6_reminders.sql`
6. `drizzle/0006_milestone7_chores.sql`
7. `drizzle/0007_grants_backfill.sql`
8. `drizzle/0008_households_update_grant.sql`
9. `drizzle/0009_milestone8_shopping_lists.sql`
10. `drizzle/0010_milestone9_finance.sql`
11. `drizzle/0011_milestone12_documents.sql`

زنجیرهٔ فایل‌های ریپو: `0001` → `0011`.

`0010` باید همان فایل workspace باشد (Finance Lite: `finance_records` با `EXPENSE | BILL`). مدل محصول فقط `finance_records` است.

`0011` جداول `documents` / `document_attachments` و bucket خصوصی `documents` را می‌سازد و جداول M1–M11 را ALTER نمی‌کند.

تاریخچهٔ hosted (اعمال‌شده): `0010_milestone9_finance`، `repair_m9_finance_lite` (فایل در `drizzle/` نیست)، `0011_milestone12_documents`. جداول `finance_records` / `documents` / `document_attachments` با RLS؛ bucket `documents` خصوصی، ۱۰MB، PDF/JPEG/PNG/WebP. جداول legacy `finance_goals` / `finance_transactions` را **حذف نکنید**.

## Auth redirect

در داشبورد Supabase:

- Site URL = `NEXT_PUBLIC_APP_URL`
- Redirect: `/api/auth/callback`
- مسیرهای اپ: `/today`, `/home`, `/finance`, `/documents`, `/settings`, …

Routeهای صفحهٔ اپ در `src/proxy.ts` برای کاربر واردنشده به `/auth/login` می‌روند (شامل `/finance` و `/documents`). APIها در matcher نیستند و خودشان `getUser()` می‌کنند.

## Quality gates قبل از انتشار

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

`npm run lint` باید بدون خطا باشد (چرخهٔ fetch اولیهٔ chores/shopping و hydration تم در ThemeToggle بدون `setState` همزمان داخل `useEffect`).

فونت Vazirmatn به‌صورت local در `src/app/fonts/` است تا `next build` به Google Fonts در زمان کامپایل وابسته نباشد.

## PWA

- Manifest: `src/app/manifest.ts`
- SW: `public/sw.js` (`khunemun-shell-v3`؛ `/api/*` cache نمی‌شود)
- Offline: `/offline` — retry فقط وقتی آنلاین است به `/today`

ادعای sync آفلاین یا صف mutation نکنید.

## چیزهایی که deploy نیست

- AI / Voice
- چند household فعال برای یک کاربر
- صف mutation آفلاین
- Two-user interactive browser QA (هنوز اجرا نشده)

## چک‌لیست انتشار

- [x] مهاجرت‌های 0001–0011 + `repair_m9_finance_lite` روی پروژهٔ khoonemoon اعمال شده
- [x] `finance_records` / `documents` / `document_attachments` + RLS + bucket خصوصی `documents`
- [x] `npm run build` روی همین commit سبز است
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_APP_URL` روی host
- [ ] Auth Site URL + redirect `/api/auth/callback` با دامنهٔ واقعی
- [ ] Deploy اپ (Vercel/Netlify یا `npm run build && npm start`) — در این محیط host/token نیست
- [ ] اختیاری: Two-user interactive QA (`E2E.md`)
