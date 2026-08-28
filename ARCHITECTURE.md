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

> نکته: با توجه به baseline پروژه، دسترسی server-side به دیتابیس از طریق Drizzle حفظ می‌شود؛ اما auth/realtime/storage/policies بر بستر Supabase طراحی می‌شود.

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
    (public)/
      welcome/page.tsx
      auth/login/page.tsx
      auth/signup/page.tsx
      auth/forgot-password/page.tsx
    (onboarding)/
      profile/page.tsx
      household/page.tsx
      invite/page.tsx
      notifications/page.tsx
    (app)/
      today/page.tsx
      calendar/page.tsx
      home/page.tsx
      lists/page.tsx
      profile/page.tsx
      settings/page.tsx
      search/page.tsx
    api/
      health/route.ts
      auth/callback/route.ts
      notifications/subscribe/route.ts
      storage/sign/route.ts
    offline/page.tsx
    manifest.ts
    layout.tsx
    globals.css

  features/
    auth/
      components/
      actions/
      queries/
      schemas.ts
      types.ts
    households/
    tasks/
    calendar/
    reminders/
    chores/
    shopping/
    finance/
    search/
    settings/

  entities/
    task/
    household/
    profile/
    shopping/
    finance/

  shared/
    ui/
      button.tsx
      input.tsx
      card.tsx
      badge.tsx
      empty-state.tsx
      loading-state.tsx
      error-state.tsx
    layout/
      app-shell.tsx
      bottom-nav.tsx
      top-bar.tsx
      quick-add-fab.tsx
    hooks/
    utils/
      date/
      number/
      rtl/
      cn.ts
    constants/

  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
    auth/
      session.ts

  services/
    recurrence/
    reminders/
    notifications/
    search/

  validation/
    common.ts
    task.ts
    household.ts

  db/
    index.ts
    schema.ts
    seed/

public/
  icons/
  pwa/
```

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

## 10) Milestone 12 architecture (Planned — not implemented)

M12 از Storage ازپیش‌مستند در §6 امنیت و از الگوی Auth/RLS فعلی استفاده می‌کند؛ معماری جدید نیست.

### تصمیم‌ها

1. **دامنه جدید** `features/documents/` + route `/documents` + API تحت `src/app/api/documents`. جدول/فایل M8 Shopping و M9 Finance دست نمی‌خورند.
2. **Visibility** همان `PRIVATE` | `HOUSEHOLD_SHARED` است. PRIVATE ⇒ `household_id IS NULL`؛ SHARED ⇒ عضویت خانهٔ فعال الزامی. کاربر بدون خانه فقط PRIVATE می‌تواند بسازد (مثل finance lite).
3. **Storage**: یک bucket خصوصی (نه public). مسیر: `user/{userId}/...` برای PRIVATE و `household/{householdId}/...` برای SHARED (`SECURITY.md` §6). دانلود/نمایش فقط با signed URL بعد از چک دسترسی metadata.
4. **Client**: `createSupabaseServerClient` / browser anon + session. **بدون service-role** در UI و route handlerهای کاربر.
5. **Mutation**: metadata با RLS روی جداول جدید؛ در صورت نیاز به اتمی بودن upload+row، RPC `SECURITY DEFINER` با `search_path = public` مثل chores/finance. Storage policy مسیر را به `auth.uid()` / `is_household_member` محدود می‌کند.
6. **Attachments**: جدول لینک جدا (`document_id`, `target_type`, `target_id`) بدون FK اجباری به هر دامنه (از تغییر migrationهای 0003–0010 پرهیز). Insert لینک فقط اگر RLS هدف را به کاربر نشان دهد.
7. **ناوبری**: تب ششم نیست. `/documents` مثل `/finance` زیر تب Home؛ آیکن TopBar مثل Search. `src/proxy.ts` باید `/documents` را protected کند (در پیاده‌سازی، نه در این spec-only).
8. **Migration آینده**: یک فایل جدید (مثلاً `drizzle/0011_milestone12_documents.sql`) فقط وقتی implementation شروع شود. الان ساخته نمی‌شود.
9. **SW**: پاسخ `/api/documents` و signed URL نباید cache-first شود؛ قانون فعلی `public/sw.js` که `/api/*` را intercept نمی‌کند کافی است.
10. **محدودیت فایل (پایه)**: allowlist mime (حداقل `application/pdf` و تصویرهای رایج `image/jpeg|png|webp`) و سقف حجم مشخص در Zod + Storage (پیشنهاد پیاده‌سازی: ۱۰ مگابایت مگر خلاف آن در implementation ثابت شود).

### ناسازگاری معماری

وجود ندارد. Storage در پلن بود ولی API/`storage/sign` هنوز پیاده نشده؛ M12 همان لایه را می‌سازد.

## 11) ریسک‌های کلیدی

1. پیچیدگی هم‌زمانی timezone + Jalali + recurrence
2. دقت RLS برای private/shared
3. realtime conflict handling
4. UX موبایل با فرم‌های طولانی RTL
