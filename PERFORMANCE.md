# PERFORMANCE.md

وضعیت: **performance review تا Milestone 12** (کد و migrationهای موجود، بدون حدس بار تولیدی)

## محدوده بررسی

- ایندکس‌های SQL در `drizzle/0001` تا `drizzle/0011` (`0012` فقط grants/`search_path` است)
- الگوی query در Route Handlerها
- محدودیت جستجو
- Service Worker / PWA cache
- عدم وجود صف mutation آفلاین (عمدی در M10)

اندازه‌گیری live (EXPLAIN، p95 API، Lighthouse) در این محیط اجرا نشده چون دیتابیس و credentials موجود نیست.

## ایندکس‌های موجود

| دامنه | ایندکس |
| --- | --- |
| Household | `household_members(household_id)`, `household_invitations(household_id, status, expires_at)` |
| Tasks | `(owner_id, status, due_at)`, `(household_id, visibility, due_at)`, `task_assignees(assignee_id)` |
| Events | `(household_id, start_at)`, `(owner_id, start_at)` |
| Reminders | `(user_id, status, remind_at)`, `(target_type, target_id)` |
| Chores | household/active، default assignee، rotation position، completions by chore/date |
| Shopping | lists by household/active، items by list/checked |
| Finance | owner+type+due، household+visibility+due، unpaid bills partial، paid_by |
| Documents | `(created_by, created_at desc)`، `(household_id, visibility, created_at desc)`، attachments by entity و `document_id` |

این ایندکس‌ها با فیلترهای RLS/لیست Today و جستجوی محدود هم‌خوان هستند.

## محدودیت‌های query

- جستجو: حداکثر ۱۵ ردیف در هر نوع، ۴۰ نتیجهٔ ادغام‌شده (`SEARCH_PER_TYPE_LIMIT` / `SEARCH_RESULT_LIMIT`)
- عبارت جستجو حداکثر ۸۰ نویسه؛ کاراکترهای `ilike`/`or` حذف می‌شوند
- دعوت‌های household در GET با `.limit(10)`
- reminders GET افق زمانی را به حداکثر ۳۰ روز clamp می‌کند
- health check فقط `profiles.id` با `.limit(1)`

## یافته‌ها (بدون تغییر معماری)

1. **لیست‌های دامنه pagination ندارند.** `GET /api/tasks`، `/api/events`، `/api/finance`، `/api/chores`، `/api/documents` همهٔ ردیف‌های مجاز RLS را برمی‌گردانند. برای MVP زوج‌ها قابل قبول است؛ رشد داده نیاز به صفحه‌بندی دارد.
2. **Chores GET چند query جدا دارد** (chores + recurrences + rotations + members + profiles). N+1 روی هر chore نیست؛ تعداد query ثابت است.
3. **Shopping GET دو query است** (lists سپس items با `.in(list_id)`). از embed شکننده پرهیز شده.
4. **Search شش منبع را موازی می‌خواند.** با limit ۱۵ این برای MVP مناسب است. `type=finance` فقط `finance_records` را می‌زند.
5. **Today bills در حافظه فیلتر می‌شوند** (`buildTodayBillItems`) بعد از خواندن finance_records. ایندکس unpaid bills در SQL برای query مستقیم Today وجود دارد ولی page Today از همان GET دامنه استفاده می‌کند.
6. **Service Worker `khunemun-shell-v3`:** navigate = network-first سپس cache سپس `/offline`؛ `/api/*` intercept نمی‌شود؛ GET استاتیک = cache-first. mutation در SW صف نمی‌شود.

## توصیه‌های غیرمسدودکننده (خارج از پیاده‌سازی M11)

- pagination برای tasks/events/finance وقتی تعداد ردیف از حدود یکی‌دو صد گذشت
- فیلتر unpaid/due در query Today به‌جای فیلتر کامل در حافظه
- اندازه‌گیری واقعی بعد از اعمال `0010` و `0011` روی پروژهٔ Supabase

M11 این‌ها را به محصول جدید تبدیل نمی‌کند؛ فقط ثبت می‌کند.
