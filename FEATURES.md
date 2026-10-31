# FEATURES.md

وضعیت: این ماتریس عمدتاً قابلیت‌های وب تا M29 را توصیف می‌کند و علامت‌های «Completed» در آن به معنی تأیید برابری نسخه مستقل اندروید یا آزمون واقعی نیستند. وضعیت انتقال و موارد باز موبایل در بخش زیر آمده است.

## Phase 1 (MVP) Feature Matrix

| Feature                   | Scope خلاصه                                           | وضعیت              |
| ------------------------- | ----------------------------------------------------- | ------------------ |
| Foundation UI/RTL/Persian | shell موبایل، RTL، typography (self-hosted)، states   | ✅ Completed (M1)  |
| Quick Add (global)        | ۵ اکشن واقعی از FAB: تسک/رویداد/خرید/قبض/کار خانه     | ✅ Completed (M13) |
| Theme                     | light/dark/system + persistence                       | ✅ Completed (M1)  |
| PWA Base                  | manifest + installability + offline fallback          | ✅ Completed (M1)  |
| Auth                      | signup/login/logout/reset + protected routes          | ✅ Completed (M2)  |
| Profile                   | ویرایش پروفایل، timezone، locale                      | ✅ Completed (M2)  |
| Household                 | create/join/leave + owner/member roles                | ✅ Completed (M3)  |
| Invitations               | invite link/code + expiration + cancel                | ✅ Completed (M3)  |
| RLS Core                  | private/shared isolation + membership checks          | ✅ Completed (M3)  |
| Tasks                     | CRUD + status + priority + visibility + assignment    | ✅ Completed (M4)  |
| Recurrence                | daily/weekly/custom with rrule-ready model            | ✅ Completed (M4)  |
| Today Dashboard           | اولویت‌بندی کارهای امروز، معوق، قبض و کار خانه        | ✅ Completed (M5)  |
| Calendar                  | month/week/agenda + tasks/events aggregation          | ✅ Completed (M5)  |
| Reminder Foundation       | data model + schedule calc + dispatch/snooze/quiet    | ✅ Completed (M6)  |
| Notification Prefs        | in-app settings + quiet hours                         | ✅ Completed (M6)  |
| Web Push Delivery         | VAPID + subscriptions + dispatch + SW handlers        | ✅ Completed (M12) |
| Chores                    | recurring chores + rotation + completion history      | ✅ Completed (M7)  |
| Shopping                  | shared list + quick add + first-list onboarding       | ✅ Completed (M8)  |
| Realtime                  | scoped sync for shopping items                        | ✅ Completed (M8)  |
| Finance Lite              | bills/expense/income + due/overdue states             | ✅ Completed (M9)  |
| Household Settlement      | net balances + suggested transfers per member         | ✅ Completed (M14) |
| Chore History             | per-member workload + who did what and when           | ✅ Completed (M16) |
| Finance Charts            | 6-month Jalali trend + category shares (plain SVG)    | ✅ Completed (M17) |
| Bundle Budget             | real per-route gzip measurement enforced in CI        | ✅ Completed (M18) |
| Reminder Inbox            | every reminder incl. delivered/canceled + actions     | ✅ Completed (M19) |
| Search                    | cross-domain search with permission filters           | ✅ Completed (M10) |
| Search Filters            | kind chips + time range, filtered client-side         | ✅ Completed (M20) |
| Finance Corrections       | edit amount/category, archive records (min patch)     | ✅ Completed (M21) |
| Chore Corrections         | edit title/frequency/rotation, archive (min patch)    | ✅ Completed (M22) |
| Due Reminder Badge        | due-reminder count on the nav, capped with a11y text  | ✅ Completed (M23) |
| Financial Ledger          | all records with type/paid/range filters (URL-driven) | ✅ Completed (M24) |
| Deployment Runbook        | env checklist + real backup/restore drill             | ✅ Completed (M25) |
| End-to-End (HTTP)         | real build: pages, redirects, API guards in CI        | ✅ Completed (M26) |
| Setup Error Feedback      | a misconfigured backend says so, never a dead button  | ✅ Completed (M27) |
| Weekly Recap              | tasks/chores/spend vs last week, server-rendered      | ✅ Completed (M28) |
| Data Export               | JSON archive + ledger CSV, RLS-authorised             | ✅ Completed (M29) |
| Settings                  | theme/reminders/PWA help/household navigation         | ✅ Completed (M10) |
| Offline Improvements      | shell cache + offline page (private pages excluded)   | ✅ Completed (M10) |
| Test Hardening            | unit tests + CI + DB-level RLS verification           | 🚧 M11             |
| Security Review           | RLS verification + grants + auth audit                | 🚧 M11             |

## وضعیت انتقال به کلاینت مستقل اندروید/وب

- رابط حساب/خانه، کارها، تقویم، کار خانه، خرید، مالی، مدارک، یادآور، نمای امروز، افزودن سریع، جستجو، خلاصه هفتگی و خروجی در کد مستقل وجود دارند؛ تأیید کامل دو حساب و دستگاه واقعی انجام نشده است.
- یادآور پس‌زمینه بدون Firebase با WorkManager پیاده شده؛ تحویل، مجوزها، Doze، راه‌اندازی مجدد و همگام‌سازی بین دو دستگاه هنوز آزمون واقعی نشده‌اند. زمان تحویل تضمین‌شده نیست.
- بازگردانی رمز با PKCE پیاده شده اما ارسال ایمیل و بازکردن لینک روی گوشی تست نشده و SMTP اختصاصی برای انتشار عمومی لازم است.
- خروجی JSON/CSV و ZIP مدارک محدود، غیرتراکنشی و گزینشی‌اند؛ ابزار بازگردانی یا تضمین پشتیبان کامل وجود ندارد. فایل‌ها، مسیر ذخیره Android و عایق‌سازی واقعی Storage هنوز نیاز به آزمون دارند.
- وب مستقل manifest و cache پوسته دارد، اما داده‌های خصوصی در service worker ذخیره نمی‌شوند و قابلیت‌های داده‌ای نیاز به اینترنت دارند؛ نصب و به‌روزرسانی در مرورگر واقعی آزموده نشده‌اند.
- تکرار کار خانه و تسک به محاسبه فعلی UTC سمت سرور وابسته است: تابع فعلی ساعت سررسید را حذف می‌کند و روزهای هفته ممکن است با ساعت محلی تفاوت داشته باشند؛ این رفتار باید قبل از اعلام تکمیل تکرار اصلاح و روی مرزهای منطقه زمانی آزموده شود. تکرار مالی فقط علامت است و مورد بعدی را نمی‌سازد.
- برابری کامل جزئیات رابط، تجربه نصب، طراحی، رسیدگی امن به فایل‌های بدون متادیتا، آزمون یکپارچه و امضای انتشار بازار همچنان باز است. APK تنها با درخواست کاربر ساخته می‌شود.

## مسیرهای کاربری (Routes)

| مسیر                     | توضیح                                                |
| ------------------------ | ---------------------------------------------------- |
| `/today`                 | داشبورد امروز: تسک، رویداد، قبض، کار خانه، یادآور    |
| `/calendar`              | تقویم ماه/هفته/فهرست                                 |
| `/home`                  | مدیریت خانه، اعضا و دعوت‌نامه‌ها                     |
| `/lists`                 | تب‌های خرید / کارهای خانه / مالی + تسویه‌حساب خانه   |
| `/finance`               | دفتر تراکنش‌ها با فیلتر نوع/پرداخت/بازه              |
| `/reminders`             | صندوق یادآورها: رسیده/امروز/پیش‌رو/تحویل‌شده/لغو‌شده |
| `/search`                | جستجوی یکپارچه                                       |
| `/profile` و `/settings` | پروفایل و تنظیمات                                    |

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
