# E2E.md

سفرهای حیاتی زوج از `FEATURES.md` و `ARCHITECTURE.md`.

اتوماسیون داخل ریپو (Vitest / Node، الگوی موجود API و گارد دامنه) در:

- `src/features/hardening/critical-journeys.test.ts`
- تست‌های authorization در `src/app/api/**` و `src/features/hardening/authorization.test.ts`

Playwright یا رانر مرورگر در این ریپو وجود ندارد و در M11 اضافه نشده (حفظ الگوی تست فعلی).

سفر زنده با دو کاربر واقعی **نیاز به پروژهٔ پیکربندی‌شدهٔ Supabase دارد.** این sandbox آن credentials را ندارد؛ پس مرورگر زنده اینجا اجرا نشده است.

## سفر ۱ — ثبت‌نام دو کاربر

1. کاربر A در `/auth/signup` ثبت‌نام کند.
2. کاربر B همین کار را با ایمیل جدا انجام دهد.
3. هر دو به `/today` برسند.

Expected: session جدا؛ بدون دیدن پروفایل کامل طرف مقابل از RLS پروفایل (فقط ردیف خود).

## سفر ۲ — Household مشترک

1. کاربر A خانه بسازد.
2. دعوت بسازد و کد را به B بدهد.
3. B با کد join کند.
4. تلاش مجدد همان کد باید `INVITATION_NOT_PENDING` بدهد.

## سفر ۳ — تسک اشتراکی

1. A تسک `HOUSEHOLD_SHARED` بسازد.
2. B آن را در Today/لیست تسک ببیند.

## سفر ۴ — تسک خصوصی

1. A تسک `PRIVATE` بسازد.
2. B آن را نبیند (`GET /api/tasks` و UI).

## سفر ۵ — خرید مشترک

1. A یک لیست در `/lists` بسازد.
2. کالا اضافه کند و check/uncheck کند.
3. B همان لیست را ببیند.
4. کاربر C در household دیگر لیست را نبیند.

Realtime کامل مرورگر در M8 جزئی است؛ پذیرش MVP حداقل همگام‌سازی پس از refresh است.

## سفر ۶ — قبض در Today

1. A قبض با `due_at` امروز یا گذشتهٔ پرداخت‌نشده بسازد.
2. صفحهٔ Today آن را نشان دهد.
3. Pay از طریق `PATCH /api/finance/[id]` با `{ action: "pay" }` سپس refresh.
4. قبض پرداخت‌شده از لیست Today خارج شود.

بدون household هم قبض PRIVATE از `/finance` باید کار کند.

## مسیرهای محافظت‌شده

کاربر خارج‌شده نباید `/today` `/home` `/finance` `/lists` `/settings` `/search` `/calendar` `/profile` را ببیند؛ redirect به `/auth/login`.
