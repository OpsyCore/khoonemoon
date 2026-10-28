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
- [ ] performance review (Lighthouse/bundle budget)
- [ ] production deployment runbook + backups/restore drill
- [ ] push delivery e2e against a real browser (needs a real device/browser)

## Quality Gate Checklist (Run each milestone)

- [x] formatter
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
