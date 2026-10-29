# TODO.md

## Current Phase

- Phase 1 (MVP)
- Current milestone: **Milestone 11 (Hardening & Release Readiness)** 🚧

## Planning Deliverables

- [x] Repository audit
- [x] PROJECT_PLAN.md / ARCHITECTURE.md / DATABASE.md / FEATURES.md / SECURITY.md / PWA.md
- [x] README.md (setup, scripts, deploy)
- [x] CI workflow (`.github/workflows/ci.yml`)

## Milestone 1 - Foundation ✅

- [x] Persian/RTL app shell
- [x] mobile-first navigation + FAB (تصمیم: در M13 به فرم واقعی متصل شد)
- [x] theme system (light/dark/system) + settings entry point
- [x] design primitives
- [x] PWA manifest/icons
- [x] service worker baseline (shell-only cache, no private page caching)
- [x] offline fallback page
- [x] route skeletons
- [x] loading/empty/error primitive states

## Milestone 2 - Auth & Profile ✅

- [x] Supabase client wiring (browser/server/middleware)
- [x] email signup/login/logout/reset
- [x] protected routes middleware (degrades gracefully if Supabase is unreachable)
- [x] profile CRUD

## Milestone 3 - Household & Invitations & RLS Core ✅

- [x] household create/join/leave (security definer RPCs)
- [x] invitation issue/accept/cancel/expire
- [x] member roles
- [x] baseline RLS policies + table grants for `authenticated`
- [x] policy verification scenarios

## Milestone 4 - Tasks & Recurrence ✅

- [x] task CRUD + visibility
- [x] assignment model
- [x] recurrence model/engine
- [x] reminder model for tasks

## Milestone 5 - Today + Calendar ✅

- [x] today aggregation
- [x] Jalali display formatting
- [x] calendar month/week/agenda baseline

## Milestone 6 - Reminders Foundation ✅

- [x] reminder scheduling model
- [x] notification preferences
- [x] push/web capability detection + permission UX + fallback

## Milestone 7 - Chores ✅

- [x] chore CRUD (create/edit/archive/pause)
- [x] recurring schedule (`calculate_next_chore_due` in SQL)
- [x] rotation baseline (`chore_rotation_steps` + `complete_chore` RPC)
- [x] completion history (`chore_completions`)
- [x] unit tests for rotation/state (`src/features/chores/rotation.test.ts`)

## Milestone 8 - Shopping + Realtime ✅

- [x] shopping lists/items CRUD
- [x] realtime sync scoped to `shopping_items` channel
- [x] optimistic toggle purchased (with rollback on failure)
- [x] first-list creation flow when a household has no list yet

## Milestone 9 - Finance Lite ✅

- [x] bills/expense/income records
- [x] due/overdue states synced by DB trigger
- [x] today dashboard integration (upcoming bills)
- [x] finance summary + unit tests

## Milestone 10 - Search + Settings + Offline ✅

- [x] global search baseline (`search_workspace` RPC, RLS-aware)
- [x] settings page (theme, reminder prefs, PWA help, household link)
- [x] offline UX (shell caching + offline page, private pages excluded)

## Milestone 29 - خروجی گرفتن از داده‌ها ✅

- [x] `GET /api/export` → آرشیو JSON از همهٔ جدول‌های دیده‌شدنی + مانیفست تعداد ردیف
- [x] `GET /api/export?format=csv` → تراکنش‌های مالی برای اکسل
- [x] مجوزدهی **دوباره‌نویسی نشد**: کوئری‌ها با نشست خود کاربر اجرا می‌شوند، پس RLS تصمیم می‌گیرد
- [x] BOM یونیکد در ابتدای CSV (بدون آن، اکسل فارسی را پنچر‌نویسی نشان می‌دهد)
- [x] فرار دادن کاما/گیومه/خط جدید در CSV — یک توضیح با کاما کل ستون‌ها را جابه‌جا می‌کند
- [x] نام فایل ASCII و تاریخ‌دار تا هیچ سروری مجبور به کدگذاری هدر نشود
- [x] دو دکمه در تنظیمات با `<a download>` — بدون جاوااسکریپت
- [x] گارد ۴۰۱ در e2e ثبت شد (نبودِ آن = نشت انبوه داده، نه یک خطای ظاهری)

## Milestone 28 - خلاصهٔ هفته روی صفحهٔ امروز ✅

- [x] `features/summary/weekly-summary.ts`: پنجرهٔ ۷ روزه + هفتهٔ قبل به‌عنوان مبنا
- [x] هر عدد با مبنای خودش؛ وقتی هفتهٔ قبل خالی است، درصد **نمی‌سازیم** (تقسیم بر صفر = دروغ)
- [x] پول با `activityDate` (پرداخت‌شده، وگرنه ثبت‌شده) — همان قاعدهٔ دفتر تراکنش‌ها
- [x] دو فیلتر ساده به‌جای یک `.or()` زیرکانه: ردیف پرداخت‌نشده با `occurred_at`، ردیف پرداخت‌شده با `paid_at`
- [x] پنجرهٔ نیم‌باز `[from, to)` تا کار روی مرز در دو هفته شمرده نشود
- [x] کارت **Server Component**: /today سنگین‌ترین مسیر باندل است، حساب‌وکتاب را به مرورگر نمی‌فرستیم (+۱ KB)
- [x] ۱۸ تست: مرز پنجره، درآمد در برابر خرج، رشتهٔ عددی پستگرس، حالت «هیچ‌کاری نشده»
- [ ] محدودیت شناخته‌شده: کاری که پس از تکمیل بایگانی شود از شمارش این هفته بیرون می‌رود

## Milestone 27 - بازخورد خطا در فرم‌ها + پیش‌نمایش Codespaces ✅

- [x] ریشهٔ «دکمه را می‌زنم هیچ اتفاقی نمی‌افتد»: `createSupabaseBrowserClient()` بدون try/catch
      صدا زده می‌شد؛ خطای پیکربندی داخل submit گم می‌شد و UI ساکت می‌ماند
- [x] `openSupabaseBrowserClient()`: خطا را به‌جای پرتاب‌کردن برمی‌گرداند؛ ۴ فرم ورود/ثبت‌نام/بازیابی/تغییر رمز
      پیام فارسی نشان می‌دهند
- [x] تست: نبودِ env نباید throw کند و پیام باید نام دو متغیر را بگوید
- [x] `.devcontainer/devcontainer.json` + `npm run dev:public` برای اجرای اپ روی Codespaces از موبایل
- [x] `https://*.app.github.dev/**` به allow list سوپابیس اضافه شد
- [x] صادقانه: GitHub Pages و Actions نمی‌توانند این اپ را میزبانی کنند (نیاز به پروسهٔ Node)

## Milestone 26 - End-to-End (HTTP) ✅

- [x] `scripts/e2e-http.mjs`: بالا آوردن build واقعی و بررسی رفتار، نه پیاده‌سازی
- [x] صفحات عمومی: ورود/ثبت‌نام/آفلاین با متن فارسی واقعی در پاسخ (۲۰۰ نه‌فقط کد)
- [x] مسیرهای محافظت‌شده بدون نشست: هدایت ۳۰۷ (نه ۵۰۰، نه ۲۰۰ خالی)
- [x] گاردهای نوشتن برای ۶ endpoint بدون نشست → ۴۰۱ (رگرسیون در گارد = نشت امنیتی)
- [x] توکن جعلی روی dispatch یادآور → ۴۰۱
- [x] اجرا در CI بعد از build؛ ۱۳ بررسی، حدود ۲۰ ثانیه
- [x] صادقانه: تعامل مرورگری (کلیک/فرم) پوشش داده نمی‌شود؛ در این محیط مرورگری وجود ندارد

## Milestone 25 - Deployment Runbook + Restore Drill ✅

- [x] `DEPLOYMENT.md`: متغیرهای محیطی (لازم/اختیاری و پیامد نبودشان)، پیکربندی Supabase، زمان‌بندی، انتشار و rollback، چک‌لیست
- [x] `scripts/deploy-check.mjs` با تابع خالص `validateEnv`: تفکیک «تنظیم نشده» از «تنظیم شدهٔ اشتباه»، هرگز چاپ نکردن مقدار کلید
- [x] `scripts/restore-drill.mjs`: چرخهٔ کامل پشتیبان‌گیری/بازگردانی روی PGlite با مقایسهٔ ردیف‌به‌ردیف
- [x] تمرین یک باگ واقعی را لو داد: بازگردانی جدول‌های دامنه بدون `auth.users` روی کلید خارجی می‌شکند
- [x] `npm run deploy:check` و `npm run drill:restore` در README و runbook
- [x] ۹ تست برای `validateEnv`

## Milestone 24 - Financial Ledger ✅

- [x] `ledger.ts`: فیلتر نوع، وضعیت پرداخت، بازهٔ زمانی و جست‌وجوی متنی روی عنوان/دسته/یادداشت
- [x] فیلتر از `searchParams` در سرور انجام می‌شود: هر نمای فیلترشده یک لینک قابل اشتراک است و صفحه هیچ جاوااسکریپت فیلتر اضافه نمی‌کند
- [x] تاریخ فیلتر (`paid_at`→`due_at`→`occurred_at`) از تاریخ مرتب‌سازی (`paid_at`→`occurred_at`) جدا شد، وگرنه قبضی با سررسید ماه آینده بالای دفتر می‌نشست
- [x] رکورد بایگانی‌شده همیشه پنهان؛ رکورد بی‌تاریخ در نمای بازه‌دار حذف می‌شود ولی در نمای کامل می‌ماند
- [x] خلاصهٔ همان فیلتر: درآمد، هزینه، قبض پرداخت‌نشده
- [x] صفحهٔ `/finance` با همان دکمه‌های اصلاح/بایگانی M21 و لینک از تب مالی
- [x] ۲۳ تست

## Milestone 23 - Due Reminder Badge ✅

- [x] شمارش یادآورهای رسیده (`PENDING`/`SNOOZED` با `remind_at <= now`) در layout و پاس دادن به نوار پایین
- [x] نشان قرمز روی آیتم «امروز»؛ بالای ۹ به `۹+` خلاصه می‌شود تا نوار شلوغ نشود
- [x] متن پنهان برای صفحه‌خوان با **عدد واقعی** («۴۲ یادآور رسیده»)، نه نسخهٔ خلاصه‌شده
- [x] `formatBadgeCount`/`describeBadge` جدا و تست‌شده (صفر و منفی چیزی نشان نمی‌دهند)
- [x] ۱۲ تست (۸ منطق + ۴ رندر با mock کردن `usePathname`)

## Milestone 22 - Correcting Chores ✅

- [x] `corrections.ts`: ساخت کمترین patch معتبر برای کار خانه (عنوان، تکرار، حالت نوبت)
- [x] مقایسهٔ معنادار عنوان (فاصله‌های اضافی تغییر نیست)
- [x] رد کردن نوبت‌بندی چرخشی در خانهٔ یک‌نفره با پیام فارسی، به‌جای ساختن نوبتی که هرگز نمی‌چرخد
- [x] بازگشت از چرخشی به ثابت در هر اندازه‌ای از خانه مجاز است
- [x] دکمهٔ «اصلاح» و «بایگانی» روی هر کار خانه (فقط برای کسی که اجازهٔ مدیریت دارد)
- [x] بایگانی با تأیید و متن صادقانه: تاریخچهٔ انجام‌شدن‌ها می‌ماند
- [x] ۱۲ تست

## Milestone 21 - Correcting Financial Records ✅

- [x] `corrections.ts`: تبدیل فرم ویرایش به **کمترین patch معتبر** (فقط فیلدهای تغییرکرده)
- [x] جلوگیری از patch خالی، چون API با «تغییری ارسال نشد.» خطای ۴۰۰ می‌دهد
- [x] مقایسهٔ معنادار: `۴۵۰٬۰۰۰` با `450000` یکسان است و تغییر به‌حساب نمی‌آید؛ فاصله‌های اضافی عنوان هم تغییر نیست
- [x] اعتبارسنجی سمت کلاینت با همان قواعد سرور (طول عنوان/دسته، سقف مبلغ، صفر مجاز)
- [x] خالی‌کردن دسته یا سررسید → `null` (پاک‌کردن آگاهانه، نه نادیده گرفتن)
- [x] دکمهٔ «اصلاح» و «بایگانی» روی هر رکورد مالی؛ پیش‌نمایش «تغییرها: مبلغ، دسته» قبل از ذخیره
- [x] بایگانی با تأیید صریح و متن صادقانه: رکورد حذف نمی‌شود، بایگانی می‌شود
- [x] `parseAmount` به `shared/utils/amount.ts` منتقل شد (استفادهٔ مشترک quick-add و اصلاح مالی)
- [x] ۳۲ تست (۲۳ اصلاح + ۹ مقدار پول)

## Milestone 20 - Search Filters ✅

- [x] `filters.ts`: فیلتر نوع نتیجه (۵ نوع) و بازهٔ زمانی (همه/۷ روز/۳۰ روز/۱ سال)
- [x] فیلتر سمت کلاینت: تغییر فیلتر هیچ درخواست شبکه‌ای جدید نمی‌زند و قرارداد `search_workspace` دست‌نخورده می‌ماند
- [x] شمارش هر نوع روی چیپ‌ها («مالی (۳)») مستقل از فیلتر نوع محاسبه می‌شود تا اعداد بعد از انتخاب صفر نشوند
- [x] نتیجهٔ بدون تاریخ برای همهٔ بازه‌ها می‌ماند (پنهان‌کردنش دلیلی ندارد که کاربر ببیند)
- [x] خواندن/نوشتن فیلترها از query string با `parseSearchFilters`/`toSearchParams` (مقدار ناشناخته نادیده گرفته می‌شود، نه خطا)
- [x] ترتیب استاندارد نوع‌ها در هر دو مسیر (URL و کلیک) یکسان است
- [x] حالت خالی مخصوص «با این فیلترها چیزی نیست» جدا از «نتیجه‌ای پیدا نشد»
- [x] ۲۶ تست

## Milestone 19 - Reminder Inbox ✅

- [x] `inbox.ts`: طبقه‌بندی هر یادآور به رسیده / امروز / پیش‌رو / تحویل‌شده / لغو‌شده
- [x] وضعیت‌های پایانی بر اساس `status` و `delivered_at` (اگر status کهنه باشد، `delivered_at` برنده است)
- [x] تاریخ نامعتبر به‌جای ناپدید شدن، «رسیده» نمایش داده می‌شود
- [x] عنوان واقعی تسک/رویداد از روی شناسه‌ها؛ هدف حذف‌شده → «تسک حذف‌شده»/«رویداد حذف‌شده»
- [x] شمارش هر وضعیت + `nextAt` (نزدیک‌ترین یادآور باز) و نشان «چند بار تعویق»
- [x] صفحهٔ `/reminders` با اقدام‌های تعویق ۱۰ دقیقه / ۱ ساعت / لغو برای موارد رسیده و امروز
- [x] جداسازی نمایش خالص (`reminder-inbox-view`) از منطق کلاینت، برای تست‌پذیری بدون router
- [x] لینک به صندوق از «امروز» و «تنظیمات»
- [x] ۲۶ تست (۲۱ منطق + ۵ رندر)

## Milestone 18 - Bundle Budget in CI ✅

- [x] `scripts/bundle-budget.mjs`: خواندن حجم واقعی JS هر مسیر از مانیفست‌های Turbopack (gzip)
- [x] `bundle-budget.json` با سقف پیش‌فرض و سقف مشترک (shared) + امکان سقف جدا برای هر مسیر
- [x] گام «Bundle budget» در CI بعد از build؛ عبور از سقف = CI قرمز
- [x] ۲۲ تست برای پارس مانیفست (رشته‌های شامل `{}`، گیومهٔ escape شده، JSON خراب) و منطق بودجه
- [x] مستندسازی در README با نمونهٔ خروجی و روش به‌روزرسانی سقف

## Milestone 17 - Finance Charts ✅

- [x] `analytics.ts`: سری ماهانه (درآمد/هزینه) و سهم دسته‌ها روی تقویم **هجری شمسی** (کلید `1405-08`)
- [x] ماه‌ها با پیمایش روزبه‌روز ساخته می‌شوند، نه جمع تقریبی ۳۰ روزه (طول ماه‌های شمسی متفاوت است)
- [x] تاریخ پول = `paid_at` → `due_at` → `occurred_at`؛ پس قبضی که مهر صادر و آبان پرداخت شده در آبان حساب می‌شود
- [x] نمودار SVG دستی (بدون recharts/d3) با نوار درآمد/هزینه و مقیاس بر اساس بیشترین ماه
- [x] فهرست سهم دسته‌ها با درصد؛ دستهٔ خالی → «بدون دسته»
- [x] ۱۹ تست (۱۶ منطق + ۳ رندر)

## Milestone 16 - Chore History ✅

- [x] ماژول `history.ts`: ساخت ورودی‌ها، گروه‌بندی روزانه (تقویم هجری شمسی) و خلاصهٔ سهم هر عضو
- [x] فقط ۳۰ روز گذشته در خلاصه؛ زمان‌های آینده (اختلاف ساعت دستگاه) نادیده گرفته می‌شوند
- [x] برچسب صادقانه برای کار حذف‌شده و عضوی که از خانه رفته («کار حذف‌شده» / «عضو سابق خانه»)
- [x] کارت «تاریخچه کارهای خانه» زیر فهرست کارها: نوار سهم هر نفر + ردیف‌های «چه کسی، چه کاری، چه ساعتی»
- [x] تاریخچه با شناسهٔ کارهای همین خانه محدود می‌شود (جدول `chore_completions` ستون `household_id` ندارد)
- [x] ۱۶ تست (۱۳ منطق + ۳ رندر)

## Milestone 15 - Scheduled Reminders ✅

- [x] workflow `reminder-dispatch` با زمان‌بندی ۱۵ دقیقه‌ای (مستقل از میزبان: Vercel/Netlify/VPS)
- [x] `scripts/dispatch-reminders.mjs` با مدیریت خطا، timeout و پیام فارسی
- [x] اجرای دستی با `gh workflow run` و امکان هدف‌گیری preview با `base_url`
- [x] اگر `APP_BASE_URL`/`CRON_SECRET` تنظیم نشده باشد: هشدار + skip (بدون شکست قرمز بی‌معنی)
- [x] مستندسازی متغیرها (variable در برابر secret) در README

## Milestone 14 - Household Settlement ✅

- [x] ماژول خالص `settleHousehold` که خرج‌های مشترک را به تراز هر عضو تبدیل می‌کند
- [x] محاسبه در «سِنت» (عدد صحیح) تا تقسیم سه‌نفره هیچ سنتی گم نکند؛ invariant جمع ترازها = صفر
- [x] فقط رکوردهای مشترک و پرداخت‌شده شمرده می‌شوند (قبض پرداخت‌نشده و رکورد دارای سررسیدِ آینده کنار گذاشته می‌شود)
- [x] پرداخت‌کننده = `paid_by` و در نبود آن `owner_id`؛ رکوردِ عضو خارج‌شده از خانه نادیده گرفته می‌شود
- [x] کمترین تعداد انتقال با الگوریتم greedy (حداکثر n-1 انتقال)
- [x] کارت «تسویه‌حساب خانه» در تب مالی `/lists` با تراز هر عضو و پیشنهاد انتقال فارسی
- [x] ۱۹ تست واحد برای settlement (تقسیم ناعادلانه، اعضای تکراری، مبلغ رشته‌ای از Postgres، حالت تسویه‌شده)

## Milestone 13 - Real Quick Add ✅

- [x] شیت «افزودن سریع» به ۵ اکشن واقعی متصل شد: تسک، رویداد، آیتم خرید، هزینه/قبض، کار خانه
- [x] هر اکشن به API موجود وصل است (بدون endpoint جدید)
- [x] انتخاب «مشترک خانه / خصوصی» با غیرفعال‌سازی خودکار وقتی کاربر عضو خانه نیست
- [x] انتخاب لیست خرید داخل شیت + پیام راهنما وقتی لیستی وجود ندارد
- [x] پشتیبانی از اعداد فارسی/عربی و جداکننده هزارگان در فیلد مبلغ
- [x] بازخورد موفقیت/خطا، `router.refresh()` برای به‌روزرسانی صفحه، بستن با Escape
- [x] دسترسی‌پذیری: `role="dialog"`, `aria-modal`, فوکوس خودکار روی عنوان
- [x] ۱۶ تست واحد که payloadهای شیت را با schemaهای سرور تطبیق می‌دهند

## Milestone 12 - Web Push Delivery ✅

- [x] `push_subscriptions` table + per-user RLS + grants
- [x] VAPID configuration with graceful degradation when unset
- [x] `/api/push/subscribe` (register / list / revoke)
- [x] dispatch sends real push payloads to every registered device
- [x] expired subscriptions (404/410) auto-revoked
- [x] service worker `push` + `notificationclick` handlers (RTL, Persian)
- [x] settings card with enable/disable + unsupported/unconfigured states
- [x] tests for payload building, schema and expiry handling

## Milestone 11 - Hardening 🚧

- [x] unit tests (recurrence/date/permissions/finance/chores)
- [x] CI (typecheck + lint + test + build)
- [x] RLS verification scenarios executed directly against Postgres
- [x] smoke script for end-to-end verification on a live environment
- [x] integration suite wired into CI (Postgres service + auth shim + RLS assertions)
- [x] local DB check without a server (`npm run db:check`, PGlite/WASM)
- [x] CI caught and fixed a real defect (`complete_chore` ambiguous `next_due_at`)
- [x] reminder dispatch endpoint (cron or signed-in user) + quiet-hours deferral + tests
- [ ] integration test suite against a disposable Supabase branch (currently: plain Postgres)
- [ ] e2e critical journeys (browser) — blocked: no browser in this environment
- [x] bundle budget enforced in CI (M18) — Lighthouse still needs a real browser
- [x] production deployment runbook + backups/restore drill (M25)
- [ ] push delivery e2e against a real browser (needs a real device/browser)

## Quality Gate Checklist (Run each milestone)

- [x] formatter
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
