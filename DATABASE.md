# DATABASE.md

## 1) اصول دیتابیس

- PostgreSQL with UUID primary keys
- UTC timestamps (`timestamptz`)
- visibility model: `PRIVATE` | `HOUSEHOLD_SHARED`
- soft-delete where needed (`archived_at`, `deleted_at`)
- RLS required on all user data tables

## 2) Enumهای اصلی

- `task_visibility` / `event_visibility` / `finance_visibility` / `document_visibility`: PRIVATE | HOUSEHOLD_SHARED
- `document_entity_type`: TASK | EVENT | CHORE | SHOPPING_LIST | FINANCE_RECORD
- `task_status`: PENDING | IN_PROGRESS | COMPLETED | SKIPPED | ARCHIVED
- `task_priority`: LOW | NORMAL | HIGH | CRITICAL
- `member_role`: OWNER | MEMBER
- `invitation_status`: PENDING | ACCEPTED | CANCELED | EXPIRED
- `finance_record_type`: EXPENSE | BILL

## 3) موجودیت‌های هسته

### profiles

- `id` (uuid, pk, references auth user id)
- `email` (unique)
- `full_name`
- `avatar_path` (nullable)
- `timezone` (default `Asia/Tehran`)
- `locale` (default `fa-IR`)
- `created_at`, `updated_at`

### households

- `id` (uuid)
- `name`
- `created_by` (fk auth.users.id)
- `created_at`, `updated_at`

### household_members

- `id` (uuid)
- `household_id` (fk households.id)
- `user_id` (fk auth.users.id)
- `role` (member_role)
- `joined_at`
- `left_at` (nullable)
- unique active membership per `(household_id, user_id)`
- unique active household per `user_id` (MVP: هر کاربر فقط یک household فعال)

### household_invitations

- `id` (uuid)
- `household_id` (fk)
- `invited_by` (fk auth.users.id)
- `invite_code_hash` (unique)
- `expires_at`
- `status` (invitation_status)
- `accepted_by` (nullable fk auth.users.id)
- `accepted_at`, `canceled_at`, `created_at`

### Milestone 3 Security Mutation Pattern

- mutationهای حساس (`join`, `leave`, `invite create/cancel`) با RPCهای `security definer` انجام می‌شوند.
- روی `household_members` و `household_invitations` policy مستقیم insert/update/delete نداریم.
- این طراحی جلوی mutation مستقیم غیرمجاز را می‌گیرد و تمام قوانین کسب‌وکار در یک لایه کنترل‌شده enforce می‌شود.

## 4) Task Domain

### tasks

- `id` (uuid)
- `household_id` (nullable fk households.id)
- `creator_id` (fk auth.users.id)
- `owner_id` (fk auth.users.id)
- `title`
- `description` (nullable)
- `visibility` (`task_visibility`)
- `status` (`task_status`)
- `priority` (`task_priority`)
- `due_at` (nullable timestamptz)
- `completed_at` (nullable)
- `archived_at` (nullable)
- `created_at`, `updated_at`

### task_assignees

- `id` (uuid)
- `task_id` (fk tasks.id)
- `assignee_id` (fk auth.users.id)
- unique(`task_id`,`assignee_id`)

### task_recurrences

- `id` (uuid)
- `task_id` (fk tasks.id unique)
- `frequency` (`task_recurrence_frequency`)
- `interval_days` (nullable int)
- `weekdays` (nullable int[])
- `next_occurrence_at` (nullable timestamptz)
- `created_at`, `updated_at`

### reminders

- `id` (uuid)
- `target_type` (TASK | EVENT)
- `target_id` (uuid)
- `user_id` (fk auth.users.id)
- `household_id` (nullable fk households.id)
- `remind_at` (timestamptz)
- `status` (PENDING | SNOOZED | SENT | CANCELED)
- `snoozed_until` (nullable timestamptz)
- `snooze_count` (int)
- `delivered_at` (nullable timestamptz)
- `created_at`, `updated_at`

## 5) Calendar Domain

### events

- `id` (uuid)
- `household_id` (nullable fk households.id)
- `creator_id` (fk auth.users.id)
- `owner_id` (fk auth.users.id)
- `title`, `description`
- `start_at`, `end_at` (timestamptz)
- `all_day` (bool)
- `location` (nullable)
- `visibility` (`event_visibility`)
- `created_at`, `updated_at`

> Note: `event_participants` در Milestone 5 پیاده‌سازی نشده و در فازهای بعدی اضافه می‌شود.

## 6) Shopping Domain

جداول خرید در `drizzle/0009_milestone8_shopping_lists.sql` هستند و در runtime با PostgREST استفاده می‌شوند؛ در `src/db/schema.ts` آینه نشده‌اند.

### shopping_lists

- `id` (uuid)
- `household_id` (fk households.id)
- `name`
- `created_by` (fk profiles.id)
- `archived_at` (nullable)
- `created_at`, `updated_at`

### shopping_items

- `id` (uuid)
- `list_id` (fk shopping_lists.id)
- `name`
- `quantity` (numeric nullable)
- `unit` (nullable)
- `category` (nullable)
- `note` (nullable)
- `added_by` (fk profiles.id)
- `purchased` (bool default false)
- `purchased_by` (nullable fk profiles.id)
- `purchased_at` (nullable)
- `created_at`, `updated_at`

## 7) Chores Domain

### chores

- `id` (uuid)
- `household_id` (fk households.id)
- `title`
- `description` (nullable)
- `visibility` (default HOUSEHOLD_SHARED)
- `default_assignee_id` (nullable fk profiles.id)
- `recurrence_rule` (text nullable)
- `is_active` (bool)
- `created_by`, `created_at`, `updated_at`

### chore_rotations

- `id` (uuid)
- `chore_id` (fk chores.id)
- `sequence_order` (int)
- `assignee_id` (fk profiles.id)
- unique(`chore_id`,`sequence_order`)

## 8) Finance Domain (M9 implemented)

Implemented in `drizzle/0010_milestone9_finance.sql`.

### finance_records

- `id` (uuid)
- `record_type` (`finance_record_type`: EXPENSE | BILL)
- `title`
- `amount` (numeric(14,2), `> 0`)
- `currency` (text default IRR)
- `owner_id` (fk auth.users.id, immutable)
- `created_by` (fk auth.users.id, immutable)
- `household_id` (nullable fk households.id, immutable in M9)
- `visibility` (`finance_visibility`: PRIVATE | HOUSEHOLD_SHARED, immutable in M9)
- `due_at` (timestamptz, required for BILL, null for EXPENSE)
- `occurred_at` (timestamptz, required for EXPENSE, null for BILL)
- `paid_at` (timestamptz, BILL only; paired with paid_by)
- `paid_by` (nullable fk auth.users.id, BILL only)
- `category` (nullable text)
- `note` (nullable text)
- `created_at`, `updated_at`

Bill status is **not stored**. Derive from `due_at` + `paid_at`:

- PAID: `paid_at IS NOT NULL`
- OVERDUE: unpaid and `due_at < startOfToday`
- DUE: unpaid and `due_at < endOfToday`
- UPCOMING: unpaid and `due_at >= endOfToday`

Write RPCs:

- `create_finance_record`
- `update_finance_record`
- `set_finance_record_paid`

RLS: PRIVATE = owner only; HOUSEHOLD_SHARED = `is_household_member(household_id)`. INSERT household is the caller’s active household. `paid_by` via `valid_finance_paid_by`.

UI: `/finance` page, Home summary + links, Today unpaid overdue/due bills, FAB `/finance#quick-add-finance`.

Not in M9: income, debt, installments, subscription product, budget, savings, goals, recurring finance engine, finance reminders, AI, voice, split ledger, reports/charts.

## 8b) Documents Domain (M12 implemented)

Implemented in `drizzle/0011_milestone12_documents.sql`. Does not ALTER previous tables.

### documents

- `id` (uuid)
- `household_id` (nullable fk households.id)
- `created_by` (fk auth.users.id)
- `title`, `description` (nullable)
- `mime_type` (pdf/jpeg/png/webp)
- `file_size` (bytes, max 10MB)
- `storage_path` (unique; `user/{uid}/...` or `household/{hid}/...`)
- `visibility` (`document_visibility`: PRIVATE | HOUSEHOLD_SHARED)
- `created_at`, `updated_at`
- PRIVATE ⇒ `household_id IS NULL`; SHARED ⇒ household required

### document_attachments

- `id` (uuid)
- `document_id` (fk documents.id cascade)
- `entity_type` TASK | EVENT | CHORE | SHOPPING_LIST | FINANCE_RECORD
- `entity_id` (uuid, no FK to domain tables)
- `created_by`, `created_at`

Storage bucket `documents` is private (`public = false`, 10MB, mime allowlist). Signed URLs are issued only after metadata SELECT succeeds (`GET /api/documents/[id]/url`).

اعمال زندهٔ `0011` روی hosted Supabase در این محیط تأیید نشده است.

## 9) Shared Support Tables

### inbox_items

- در M1–M12 پیاده‌سازی نشده (خارج از محدوده).

### notification_preferences

- `user_id` unique (fk auth.users.id)
- `in_app_enabled`
- `web_push_enabled`
- `quiet_hours_enabled`
- `quiet_hours_start`, `quiet_hours_end`
- `created_at`, `updated_at`

### push_subscriptions

- در M1–M12 پیاده‌سازی نشده (خارج از محدوده).

## 10) ایندکس‌های کلیدی

- `tasks(owner_id, status, due_at)`
- `tasks(household_id, visibility, due_at)`
- `task_assignees(assignee_id)`
- `events(household_id, start_at)`
- `shopping_items(list_id, purchased)`
- `finance_records(owner_id, record_type, due_at)`
- `finance_records(household_id, visibility, due_at)`
- unpaid bills partial index: `finance_records(due_at) WHERE record_type = 'BILL' AND paid_at IS NULL`
- `household_invitations(household_id, status, expires_at)`
- `documents(created_by, created_at desc)`
- `documents(household_id, visibility, created_at desc)`
- `document_attachments(entity_type, entity_id)`
- `document_attachments(document_id)`

## 11) RLS Policy Model (خلاصه)

- کاربر فقط پروفایل خودش را می‌خواند/ویرایش می‌کند.
- household data فقط برای اعضای همان household.
- رکورد PRIVATE: فقط owner_id
- رکورد HOUSEHOLD_SHARED: اعضای household مرتبط
- invitation create/cancel: فقط اعضای مجاز household (role-aware)
- join by invite: فقط invite معتبر + منقضی‌نشده + استفاده‌نشده

## 12) قواعد مهم دیتایی

- PRIVATE record نباید household_id غیرمعتبر داشته باشد.
- برای HOUSEHOLD_SHARED وجود household_id اجباری است.
- owner_id همیشه set باشد.
- delete سخت برای داده اصلی ممنوع؛ soft-delete ترجیحی.

## 13) Recurrence Strategy

- recurrence در `task_recurrences` با `frequency + interval_days + weekdays` ذخیره می‌شود.
- occurrenceها به صورت lazy/generated در query window محاسبه می‌شوند.
- از تولید بی‌نهایت row جلوگیری می‌شود.
- `next_occurrence_at` برای پردازش reminder queue نگهداری می‌شود.
- reminder records (`reminders`) منبع اصلی برنامه‌ریزی اعلان هستند و قابل استفاده مجدد برای کلاینت‌های Android/iOS آینده می‌باشند.

## 14) Migration Strategy

- schema از طریق فایل‌های SQL شماره‌دار در `drizzle/` versioned می‌شود (`0001` … `0011`).
- migrationها idempotent و non-destructive طراحی شده‌اند.
- اعمال روی hosted Supabase دستی است؛ این محیط `0010` و `0011` را اعمال/verify نکرده است.
