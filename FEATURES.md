# FEATURES.md

وضعیت فعلی: **M1–M12 COMPLETE** — Finance Lite (`finance_records`) + Documents + `0012` security hardening APPLIED on hosted khoonemoon.

## Phase 1 (MVP) Feature Matrix

| Feature                   | Scope خلاصه                                        | وضعیت             |
| ------------------------- | -------------------------------------------------- | ----------------- |
| Foundation UI/RTL/Persian | shell موبایل، RTL، typography، states              | ✅ Completed (M1) |
| Theme                     | light/dark/system + persistence                    | ✅ Completed (M1) |
| PWA Base                  | manifest + installability + offline fallback       | ✅ Completed (M1) |
| Auth                      | signup/login/logout/reset + protected routes       | ✅ Completed (M2) |
| Profile                   | ویرایش پروفایل، timezone، locale                   | ✅ Completed (M2) |
| Household                 | create/join/leave + owner/member roles             | ✅ Completed (M3) |
| Invitations               | invite link/code + expiration + cancel             | ✅ Completed (M3) |
| RLS Core                  | private/shared isolation + membership checks       | ✅ Completed (M3) |
| Tasks                     | CRUD + status + priority + visibility + assignment | ✅ Completed (M4) |
| Recurrence                | daily/weekly/custom with rrule model               | ✅ Completed (M4) |
| Today Dashboard           | اولویت‌بندی کارهای امروز و overdue                 | ✅ Completed (M5) |
| Calendar                  | month/week/agenda + tasks/events aggregation       | ✅ Completed (M5) |
| Reminder Foundation       | data model + schedule calculations                 | ✅ Completed (M6) |
| Notification Prefs        | in-app/web push settings                           | ✅ Completed (M6) |
| Chores                    | recurring chores + assignment/rotation پایه        | ✅ Completed (M7) |
| Shopping                  | shared list + quick check/uncheck                  | ✅ Completed (M8) |
| Realtime                  | scoped sync for shopping + shared task updates     | Partial (M8)      |
| Finance Lite              | bills + one-off expenses; PRIVATE/SHARED; `/finance` + Today + Home + FAB | ✅ Completed (M9) |
| Search                    | cross-domain search with permission filters        | ✅ Completed (M10) |
| Settings                  | account/theme/connection/reminders on `/settings`  | ✅ Completed (M10) |
| Offline Improvements      | SW fallback + connection status + retry UX         | ✅ Completed (M10) |
| Test Hardening            | unit/integration/e2e critical flows                | ✅ Completed (M11) |
| Security Review           | RLS verification + auth audit                      | ✅ Completed (M11) |
| Documents & Attachments   | metadata + private Storage + signed URL + isolation | ✅ Completed (M12) |

## Milestone 12 — Documents & Attachments ✅ Completed

اولین آیتم Phase 2. در کد و روی hosted **khoonemoon** پیاده‌سازی شده (`drizzle/0011_milestone12_documents.sql` APPLIED).

### داخل M12 (تحویل‌شده)

- مدارک به‌عنوان موجودیت مستقل: عنوان، توضیح اختیاری، نوع/mime، حجم، مسیر Storage، uploader، `visibility` (`PRIVATE` | `HOUSEHOLD_SHARED`)، `household_id`، `created_at` / `updated_at`
- پیوست اختیاری به موجودیت‌های فعلی از طریق جدول لینک `document_attachments` — **بدون ALTER** روی جداول M8 Shopping / M9 Finance / tasks / events / chores
- هدف‌های مجاز لینک: `TASK` | `EVENT` | `CHORE` | `SHOPPING_LIST` | `FINANCE_RECORD` — فقط اگر کاربر طبق RLS فعلی به هدف دسترسی داشته باشد
- Storage خصوصی (bucket `documents`) + signed URL پس از دسترسی metadata؛ فایل عمومی نیست
- صفحه `/documents` (نه تب ششم): list / upload / view-download / delete + loading/empty/error/retry
- دسترسی از TopBar (مثل Search/Settings)؛ تب Home روی `/documents` فعال می‌ماند (مثل `/finance`)
- API: `/api/documents`, `/api/documents/[id]`, `/api/documents/[id]/url`, `/api/documents/[id]/attachments`, `/api/documents/[id]/attachments/[attachmentId]`

### خارج از M12

- Health / Vehicles / Meal / Goals / Advanced Finance / Reports
- OCR / AI
- اشتراک خارج از household
- URL عمومی فایل
- صف upload آفلاین
- Playwright
- گسترش enum یادآور (همچنان `TASK` | `EVENT`)

## خارج از MVP (Phase 2+، بعد از M12)

- Health module کامل
- Vehicles module کامل
- Meal planning کامل
- Goals/Savings کامل
- Advanced routines/templates
- AI/Voice

## خارج از Milestone 9 (Finance Lite)

M9 شامل این‌ها **نیست**:

- Income
- Debt
- Installments
- Subscription product
- Budget
- Savings
- Goals
- Recurring finance engine
- Finance reminders
- AI
- Voice
- Split ledger
- Reports/charts

## تعریف کامل شدن فیچر

هر آیتم تنها وقتی Complete می‌شود که:

- schema + policy + server logic + UI + validation + states + tests آماده باشد.

## نمونه سناریوهای پذیرش MVP

1. دو کاربر ثبت‌نام می‌کنند.
2. Household مشترک تشکیل می‌دهند.
3. کاربر A تسک shared می‌سازد؛؛ کاربر B می‌بیند.
4. کاربر A تسک private می‌سازد؛ کاربر B نمی‌بیند.
5. shopping item در لحظه sync می‌شود.
6. bill ثبت می‌شود و قبض‌های معوق/سررسید امروز در صفحهٔ Today دیده می‌شوند.
