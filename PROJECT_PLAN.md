# PROJECT_PLAN.md

## محصول

- نام موقت: **خونه‌مون**
- نوع محصول: Shared Life Operating System برای زوج‌ها (نه صرفاً Todo App)
- تجربه اصلی: **موبایل‌محور، فارسی، RTL، PWA قابل نصب**

## وضعیت فعلی ریپازیتوری

- پروژه یک Starter مینیمال Next.js + Drizzle + PostgreSQL است.
- هنوز هیچ دامنه محصولی (auth, household, tasks, realtime, PWA) پیاده‌سازی نشده است.
- اسکیمای دیتابیس خالی است.
- فعلاً فقط `DATABASE_URL` تنظیم شده و تنظیمات Supabase وجود ندارد.

## اهداف MVP (Phase 1)

MVP باید حداقل این قابلیت‌ها را end-to-end داشته باشد:

1. احراز هویت (ثبت‌نام/ورود/خروج/بازیابی رمز)
2. پروفایل کاربر
3. Household + دعوت شریک + عضویت امن
4. تسک‌های خصوصی/اشتراکی با مجوز صحیح
5. Recurrence پایه برای تسک‌ها
6. Today dashboard فارسی
7. تقویم پایه
8. chores پایه
9. shopping realtime مشترک
10. bills/finance پایه
11. تنظیمات + تم + ترجیحات اعلان
12. PWA پایه + offline fallback
13. RLS و ایزولیشن داده خصوصی/اشتراکی

## فازبندی کلان

- **Phase 1 (MVP)**: foundation + auth + household + tasks + calendar + shopping realtime + finance-lite + search + settings + PWA پایه
- **Phase 2**: attachments/documents + health + vehicles + meal + goals + advanced finance/reporting
- **Phase 3**: AI/voice + intelligent parsing + smart planning + external integrations

اولین milestone اجرایی Phase 2: **Milestone 12 — Documents & Attachments** (بقیهٔ آیتم‌های Phase 2 خارج از M12 هستند).

## معماری اجرایی فاز 1

- **Frontend**: Next.js App Router + TypeScript + Tailwind
- **Auth/Realtime/Storage/RLS**: Supabase
- **DB modeling/migrations/query ergonomics**: Drizzle ORM
- **Validation**: Zod
- **Forms**: React Hook Form + zod resolver
- **Client data sync**: Server Components + targeted client fetching; TanStack Query فقط جایی که ارزش افزوده دارد

## Milestones اجرایی (Phase 1)

1. **Milestone 1**: Foundation UI/UX + RTL + theming + app shell + PWA base + docs
2. **Milestone 2**: Supabase wiring + Auth flows + profiles
3. **Milestone 3**: households + invitations + membership + RLS core
4. **Milestone 4**: tasks + visibility/privacy + assignment + recurrence model
5. **Milestone 5**: today dashboard + calendar aggregation
6. **Milestone 6**: reminder domain + notification preferences
7. **Milestone 7**: chores module
8. **Milestone 8**: shopping lists + realtime sync
9. **Milestone 9**: finance/bills lite
10. **Milestone 10**: search + settings + offline improvements
11. **Milestone 11**: testing hardening + security review + perf + release readiness

## Milestones اجرایی (Phase 2)

12. **Milestone 12**: Documents & Attachments — metadata + private Storage + signed URL + household isolation (بدون Health/Vehicles/Meal/Goals/Advanced Finance)

## کیفیت و Definition of Done

هر فیچر زمانی کامل است که شامل این موارد باشد:

- UI + منطق کسب‌وکار + دیتابیس + مجوز/امنیت + validation
- loading/empty/error states
- رفتار responsive و RTL
- تست‌های مرتبط (حداقل unit/integration برای منطق حساس)

## گیت‌های پایان هر Milestone

- format
- lint
- typecheck
- tests مرتبط
- production build (در milestoneهای ادغامی)
- بروزرسانی TODO.md

## Milestone 1 (جزئیات دقیق)

### هدف

ایجاد زیرساخت UI/UX و فنی بدون ورود به فیچرهای دامنه‌ای سنگین.

### خروجی‌های دقیق

1. **App shell** موبایل‌محور
   - هدر مینیمال
   - bottom navigation (امروز، تقویم، خونه، لیست‌ها، پروفایل)
   - global quick add FAB
2. **Persian/RTL foundation**
   - `lang="fa"` و `dir="rtl"`
   - فونت مناسب فارسی
   - spacing و icon alignment سازگار RTL
3. **Theme system**
   - light/dark/system
   - persistence
4. **Design tokens & primitive components**
   - Button/Input/Card/Badge/EmptyState/LoadingState/ErrorState
5. **PWA base**
   - manifest
   - icons placeholders
   - service worker strategy پایه
   - offline fallback page
6. **Route skeletons**
   - pages پایه برای navigation
   - stateهای loading/empty اولیه
7. **Engineering baseline**
   - خط‌مشی error handling
   - helperهای format تاریخ/عدد فارسی (بدون Jalali کامل هنوز)

### خارج از محدوده Milestone 1

- auth واقعی
- household logic
- task persistence
- realtime subscriptions

### ریسک‌ها

- سازگاری PWA با نسخه Next.js فعلی
- سازگاری لایبرری تقویم جلالی با SSR/RSC
- مدیریت safe-area موبایل و keyboard overlays

### Acceptance Criteria

- اپ روی موبایل UX روان داشته باشد
- RTL کامل در shell و کامپوننت‌های پایه رعایت شود
- تم روشن/تیره کار کند
- PWA metadata معتبر باشد
- build بدون خطا پاس شود

## الزامات محیطی آینده نزدیک

- افزودن متغیرهای Supabase در `.env.example`
- تنظیم redirect/auth URLها برای محیط local/staging/prod

## ترتیب اجرای بعدی

پس از تایید برنامه:

- فقط Milestone 1 پیاده‌سازی می‌شود.
- پس از اتمام Milestone 1، QA و سپس توقف برای تایید Milestone 2.
