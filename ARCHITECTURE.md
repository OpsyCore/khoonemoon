# ARCHITECTURE.md

## 1) اصول معماری

- Mobile-first, Persian-first, RTL-first
- Privacy-by-default (خصوصاً داده‌های حساس)
- Server-driven data access with strict authorization
- Domain-oriented modules (نه یک UI monolith)
- Future-ready برای native clients (Android/iOS/Flutter)

## 2) فناوری‌ها (تصمیم فعلی)

- Next.js App Router + TypeScript
- Tailwind CSS
- Drizzle ORM برای مدل‌سازی/مهاجرت/کوئری‌های سمت سرور
- Supabase برای Auth + Realtime + Storage + RLS روی PostgreSQL
- Zod برای validation مشترک
- React Hook Form برای فرم‌ها

> نکته: مدل‌سازی/مهاجرت با Drizzle SQL files است. Runtime خواندن/نوشتن دامنه از کلاینت authenticated Supabase (PostgREST + RLS) است، نه queryهای Drizzle در Route Handlerها.

## 3) مرزبندی Server / Client

### Server (RSC, Route Handlers, Server Actions)

- خواندن/نوشتن داده حساس
- اعتبارسنجی ورودی و authorization
- اتصال به Drizzle/Supabase server client
- عملیات مربوط به storage signed URL

### Client Components

- تعاملات UI (forms, drawers, optimistic updates)
- subscriptions محدود realtime
- state موقتی UX

### قوانین

- secretها فقط سرور
- عدم bypass شدن RLS با API ناامن
- هر mutation حساس باید authorization مستقل داشته باشد

## 4) لایه‌بندی پیشنهادی

- `app/`: routing, layouts, screens
- `features/`: ماژول‌های دامنه (tasks, households, shopping...)
- `entities/`: مدل‌ها/انواع مشترک دامنه
- `shared/`: ui primitives, utils, hooks, constants
- `db/`: schema + migrations + access layer
- `lib/supabase/`: browser/server/middleware clients
- `services/`: application services (reminders, recurrence, search)
- `validation/`: zod schemas

## 5) ساختار دقیق پوشه‌ها

```text
src/
  app/
    (public)/auth/{login,signup,forgot-password,update-password}/
    (app)/{today,calendar,home,lists,profile,settings,search,finance,documents}/
    api/{auth,health,profile,household,tasks,events,reminders,reminder-preferences,
         chores,shopping,finance,search,documents}/
    offline/page.tsx
    manifest.ts
  features/{auth,households,tasks,calendar,reminders,chores,shopping,finance,search,settings,documents,hardening,profile}/
  shared/{ui,layout,offline,utils}/
  lib/supabase/{client,server,middleware,env}.ts
  db/{index.ts,schema.ts}
  proxy.ts

drizzle/0001 … 0011
public/{sw.js,icons/}
```

صفحهٔ signed URL مدارک: `GET /api/documents/[id]/url` (مسیر جداگانهٔ `storage/sign` وجود ندارد).
ناوبری پایین: ۵ تب (امروز، تقویم، خونه، لیست‌ها، پروفایل). `/finance` و `/documents` زیر تب Home؛ Search/Settings/Documents از TopBar.

## 6) الگوی Data Access

- Queryهای page-level: ترجیحاً Server Components
- Mutationها: Server Actions یا Route Handlers با validation + auth check
- Realtime: فقط روی کانال‌های موردنیاز (shopping items, shared task updates)

## 7) Date/Time Strategy

- canonical storage: `timestamptz` (UTC)
- user timezone در profile نگهداری می‌شود
- household timezone اختیاری
- نمایش: Jalali + Persian locale
- recurrence ruleها جدا از occurrenceهای واقعی

## 8) استراتژی Error Handling

- domain error codes (مثلاً `INVITE_EXPIRED`, `NOT_HOUSEHOLD_MEMBER`)
- نمایش پیام فارسی کاربرپسند
- لاگ امن بدون داده حساس

## 9) استراتژی تست

- unit: recurrence/reminder/date logic
- integration: authorization + household rules
- e2e: journeyهای حیاتی زوج (signup تا shared task/shopping)

## 10) Milestone 12 architecture (implemented)

M12 از Storage مستند در `SECURITY.md` §6 و الگوی Auth/RLS فعلی استفاده می‌کند؛ معماری جدید نیست.

### تصمیم‌های پیاده‌شده

1. **دامنه** `features/documents/` + صفحه `/documents` + API تحت `src/app/api/documents`. جدول/فایل M8 Shopping و M9 Finance دست نخورده‌اند.
2. **Visibility** همان `PRIVATE` | `HOUSEHOLD_SHARED`. PRIVATE ⇒ `household_id IS NULL`؛ SHARED ⇒ عضویت خانهٔ فعال الزامی. کاربر بدون خانه فقط PRIVATE می‌سازد.
3. **Storage**: bucket خصوصی `documents`. مسیر: `user/{userId}/...` برای PRIVATE و `household/{householdId}/...` برای SHARED. دانلود/نمایش فقط با signed URL (۶۰ ثانیه) بعد از `SELECT` موفق metadata.
4. **Client**: `createSupabaseServerClient` (anon + session). **بدون service-role** در UI و route handlerهای کاربر.
5. **Mutation**: insert/update/delete metadata با RLS روی جداول جدید. Upload سپس insert؛ اگر insert شکست بخورد فایل Storage حذف می‌شود. Delete: ابتدا Storage سپس ردیف. Storage policy مسیر را به `auth.uid()` / `is_household_member` محدود می‌کند.
6. **Attachments**: جدول لینک `document_attachments` (`document_id`, `entity_type`, `entity_id`) بدون FK به دامنهٔ هدف. Insert فقط اگر RLS هم مدرک و هم موجودیت مقصد را نشان دهد.
7. **ناوبری**: تب ششم نیست. `/documents` مثل `/finance` زیر تب Home؛ آیکن TopBar. `src/proxy.ts` مسیر `/documents` را protected می‌کند.
8. **Migration**: `drizzle/0011_milestone12_documents.sql` (بدون ALTER روی 0003–0010).
9. **SW**: `public/sw.js` مسیر `/api/*` را intercept نمی‌کند.
10. **محدودیت فایل**: mime `application/pdf` | `image/jpeg` | `image/png` | `image/webp`؛ سقف ۱۰ مگابایت (Zod + CHECK + bucket).

## 11) ریسک‌های کلیدی

1. پیچیدگی هم‌زمانی timezone + Jalali + recurrence
2. دقت RLS برای private/shared
3. realtime conflict handling
4. UX موبایل با فرم‌های طولانی RTL
