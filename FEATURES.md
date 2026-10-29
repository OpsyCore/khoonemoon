# FEATURES.md

وضعیت فعلی: **MVP فاز ۱ پیاده‌سازی شده (M1–M10)؛ M11 در حال تکمیل**

## Phase 1 (MVP) Feature Matrix

| Feature                   | Scope خلاصه                                         | وضعیت              |
| ------------------------- | --------------------------------------------------- | ------------------ |
| Foundation UI/RTL/Persian | shell موبایل، RTL، typography (self-hosted)، states | ✅ Completed (M1)  |
| Quick Add (global)        | ۵ اکشن واقعی از FAB: تسک/رویداد/خرید/قبض/کار خانه   | ✅ Completed (M13) |
| Theme                     | light/dark/system + persistence                     | ✅ Completed (M1)  |
| PWA Base                  | manifest + installability + offline fallback        | ✅ Completed (M1)  |
| Auth                      | signup/login/logout/reset + protected routes        | ✅ Completed (M2)  |
| Profile                   | ویرایش پروفایل، timezone، locale                    | ✅ Completed (M2)  |
| Household                 | create/join/leave + owner/member roles              | ✅ Completed (M3)  |
| Invitations               | invite link/code + expiration + cancel              | ✅ Completed (M3)  |
| RLS Core                  | private/shared isolation + membership checks        | ✅ Completed (M3)  |
| Tasks                     | CRUD + status + priority + visibility + assignment  | ✅ Completed (M4)  |
| Recurrence                | daily/weekly/custom with rrule-ready model          | ✅ Completed (M4)  |
| Today Dashboard           | اولویت‌بندی کارهای امروز، معوق، قبض و کار خانه      | ✅ Completed (M5)  |
| Calendar                  | month/week/agenda + tasks/events aggregation        | ✅ Completed (M5)  |
| Reminder Foundation       | data model + schedule calc + dispatch/snooze/quiet  | ✅ Completed (M6)  |
| Notification Prefs        | in-app settings + quiet hours                       | ✅ Completed (M6)  |
| Web Push Delivery         | VAPID + subscriptions + dispatch + SW handlers      | ✅ Completed (M12) |
| Chores                    | recurring chores + rotation + completion history    | ✅ Completed (M7)  |
| Shopping                  | shared list + quick add + first-list onboarding     | ✅ Completed (M8)  |
| Realtime                  | scoped sync for shopping items                      | ✅ Completed (M8)  |
| Finance Lite              | bills/expense/income + due/overdue states           | ✅ Completed (M9)  |
| Household Settlement      | net balances + suggested transfers per member       | ✅ Completed (M14) |
| Chore History             | per-member workload + who did what and when         | ✅ Completed (M16) |
| Finance Charts            | 6-month Jalali trend + category shares (plain SVG)  | ✅ Completed (M17) |
| Search                    | cross-domain search with permission filters         | ✅ Completed (M10) |
| Settings                  | theme/reminders/PWA help/household navigation       | ✅ Completed (M10) |
| Offline Improvements      | shell cache + offline page (private pages excluded) | ✅ Completed (M10) |
| Test Hardening            | unit tests + CI + DB-level RLS verification         | 🚧 M11             |
| Security Review           | RLS verification + grants + auth audit              | 🚧 M11             |

## مسیرهای کاربری (Routes)

| مسیر                     | توضیح                                              |
| ------------------------ | -------------------------------------------------- |
| `/today`                 | داشبورد امروز: تسک، رویداد، قبض، کار خانه، یادآور  |
| `/calendar`              | تقویم ماه/هفته/فهرست                               |
| `/home`                  | مدیریت خانه، اعضا و دعوت‌نامه‌ها                   |
| `/lists`                 | تب‌های خرید / کارهای خانه / مالی + تسویه‌حساب خانه |
| `/search`                | جستجوی یکپارچه                                     |
| `/profile` و `/settings` | پروفایل و تنظیمات                                  |

## خارج از MVP (Phase 2+)

- Documents/attachments
- Health module
- Vehicles module
- Meal planning
- Goals/Savings
- Advanced routines/templates
- AI/Voice و پارس هوشمند ورودی

## تعریف کامل شدن فیچر

هر آیتم تنها وقتی Complete می‌شود که:

- schema + policy + server logic + UI + validation + states + tests آماده باشد.

## سناریوهای پذیرش MVP

1. دو کاربر ثبت‌نام می‌کنند.
2. Household مشترک تشکیل می‌دهند.
3. کاربر A تسک shared می‌سازد؛ کاربر B می‌بیند.
4. کاربر A تسک private می‌سازد؛ کاربر B نمی‌بیند.
5. shopping item در لحظه sync می‌شود.
6. bill ثبت و در today dashboard نمایش داده می‌شود.
7. کار خانه نوبتی با «انجام شد» به نفر بعد می‌چرخد.
8. جستجو فقط داده‌های مجاز کاربر را برمی‌گرداند.

وضعیت اجرا: موارد 1–4، 6 و 8 به‌صورت خودکار (smoke + RLS assertions) پوشش داده
شده‌اند؛ مورد 5 نیاز به دو مرورگر هم‌زمان دارد و در محیط بدون مرورگر دستی تست می‌شود.
