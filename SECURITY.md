# SECURITY.md

## 1) Security Principles

- Zero trust for client input
- Privacy-by-default
- DB-enforced authorization (RLS first)
- Least privilege access
- No secret leakage to client

## 2) Data Classification

- **Private**: health notes, personal tasks, personal finance, private docs
- **Household Shared**: shared tasks, shopping lists, shared bills/events
- **System/Internal**: audit metadata, job status, reminder queues

## 3) Auth Strategy

- Supabase Auth (email/password, reset password)
- Persistent session via secure cookies
- middleware checks for protected routes
- future-ready for Google/Apple/phone

## 4) Authorization Strategy

- Every record has owner context; shared records also have household context.
- UI filtering is non-security; real enforcement in RLS/policies.
- Server mutations always verify:
  1. authenticated user
  2. household membership (if household-scoped)
  3. visibility constraints

## 5) RLS Core Rules (Implemented in M2/M4)

1. profiles: read/insert/update own profile only ✅
2. households: read only if active member of household ✅
3. households update: owner-only ✅
4. household_members:
   - select: only members of same household ✅
   - direct insert/update/delete: denied (no policies) ✅
5. household_invitations:
   - select: only household members ✅
   - direct insert/update/delete: denied (RPC-only mutation) ✅
6. tasks:
   - PRIVATE task: only owner ✅
   - HOUSEHOLD_SHARED task: active household members ✅
   - task_assignees/task_recurrences inherit task access via helper policies ✅
7. events/calendar (M5 implemented):
   - PRIVATE event: only owner ✅
   - HOUSEHOLD_SHARED event: active household members ✅
8. reminders/preferences (M6 implemented):
   - reminders: user can read/update/delete only own reminders ✅
   - reminder insert requires authenticated owner + target access validation ✅
   - notification_preferences: own row only ✅
9. controlled mutations via `security definer` RPC:
   - create_household
   - create_household_invitation
   - join_household_with_invitation
   - cancel_household_invitation
   - leave_current_household
   - create_chore / update_chore / complete_chore
   - create_finance_record / update_finance_record / set_finance_record_paid
10. finance (M9 implemented):
   - PRIVATE record: only owner ✅
   - HOUSEHOLD_SHARED record: active household members ✅
   - `owner_id` / `created_by` / `household_id` / `visibility` / `record_type` immutable after insert ✅
   - `paid_by` must be owner (private) or active household member (shared) ✅
   - no stored bill status; paid state is `paid_at` + `paid_by` pair ✅
   - no finance reminder target types; reminder enum remains TASK | EVENT ✅
11. search (M10 implemented):
   - GET /api/search uses the authenticated user client (no service-role) ✅
   - results are whatever RLS already allows on tasks/chores/shopping/events/finance ✅
   - document titles are **not** in search (out of M12) ✅
12. documents (M12 implemented):
   - PRIVATE document: uploader (`created_by = auth.uid()`) only ✅
   - HOUSEHOLD_SHARED document: `is_household_member(household_id)` only ✅
   - `created_by` / `household_id` / `visibility` / `storage_path` / `mime_type` / `file_size` immutable after insert ✅
   - attachments require access to **both** the document and the target entity ✅
   - storage bucket `documents` is private; no public object URLs ✅

## 6) Storage Security (Supabase Storage)

- No public buckets for private docs. M12 bucket `documents` is created `public = false`.
- Object path convention: `user/{userId}/...` for private and `household/{householdId}/...` for shared.
- Access via short-lived signed URLs after metadata authorization (`GET /api/documents/[id]/url`, TTL 60s). No `getPublicUrl`.
- Validate mime type + size before upload (allowlist + 10MB).

## 7) Input Validation

- Zod schemas on all external input paths:
  - forms
  - route handlers
  - server actions
  - AI structured payloads (future)

## 8) Sensitive Operations

- account deletion: re-auth + confirmation step
- household owner leave: transfer ownership flow required
- visibility change private<->shared: explicit checks and audit trail

## 9) Logging & Observability

- Never log: passwords, tokens, note content, health data, secrets.
- Log only metadata (event type, actor id, entity id, status code).
- Prepare hooks for Sentry-like provider in production.

## 10) Threat/Risk Focus Areas

- IDOR via route handlers
- weak invitation links/reuse attacks
- RLS policy gaps in join conditions
- replay of expired invite
- accidental storage object exposure

## 11) Verification Plan

- policy verification SQL scenarios (allow/deny)
- integration tests for household boundaries
- e2e test for private/shared visibility isolation
- Milestone 3 security checks documented in `SECURITY_TESTS.md`
- automated unit checks in `src/features/households/security.test.ts`
- Milestone 4 task security/recurrence/completion tests in:
  - `src/features/tasks/security.test.ts`
  - `src/features/tasks/recurrence.test.ts`
- Milestone 6 reminder/timezone/snooze tests in:
  - `src/features/reminders/calculations.test.ts`
- Milestone 9 finance tests in:
  - `src/app/api/finance/finance-api.test.ts`
  - `src/features/finance/security.test.ts`
  - `src/features/finance/schemas.test.ts`
  - `src/features/finance/status.test.ts`
  - `src/features/finance/today.test.ts`
  - `src/features/finance/server.test.ts`

## 12) Milestone 11 Security Review

Reviewed against committed M1–M10 code (no RLS architecture change).

### Auth

- Runtime uses `createSupabaseServerClient` with the **anon** key and user cookies. No `SERVICE_ROLE` usage under `src/`.
- `(app)/layout.tsx` redirects unauthenticated users. `src/proxy.ts` also protects page prefixes including `/finance` and `/documents`.
- API routes are not in the proxy matcher; each handler calls `getUser()` and returns 401.
- `/offline` stays public. Guest-only auth paths: login/signup/forgot-password.

### Isolation

- Visibility is only `PRIVATE` | `HOUSEHOLD_SHARED`. Assignment/`paid_by` is not a visibility grant.
- PRIVATE ⇒ `household_id IS NULL`; SHARED ⇒ household required. Enforced in SQL checks + server validate helpers.
- Search uses the authenticated client; results are whatever RLS already allows.
- Profiles: select/update own row only. Partner display names often fall back to `"کاربر"`.

### Mutation control

- Household join/leave/invite: security-definer RPCs; no direct insert/update/delete policies on members/invitations.
- Chores writes: `create_chore` / `update_chore` / `complete_chore`.
- Finance writes: `create_finance_record` / `update_finance_record` / `set_finance_record_paid`.
- Shopping lists are household-scoped; item insert first selects the list (RLS) then inserts.

### Findings (documented, not silent product changes)

1. Some PATCH/DELETE handlers (events, tasks delete, reminder cancel) return `{ ok: true }` if PostgREST reports no error even when RLS updated 0 rows. Shopping/finance/household-name update use `select`/`maybeSingle` after write and treat missing rows as failure. Enforcement remains RLS.
2. `GET /api/health` uses the user-scoped client; it does not bypass RLS.
3. Live two-user RLS on hosted Supabase is still required (`SECURITY_TESTS.md`, `E2E.md`). This environment has no `DATABASE_URL` / user credentials.

### Automated M11 coverage

- `src/features/hardening/authorization.test.ts`
- `src/features/hardening/critical-journeys.test.ts`
- `src/app/api/tasks/tasks-api.test.ts`
- `src/app/api/events/events-api.test.ts`
- `src/app/api/household/household-api.test.ts`
- `src/app/api/chores/chores-api.test.ts`
- `src/app/api/reminders/reminders-api.test.ts`
- `src/app/api/profile/profile-api.test.ts`
- `src/features/hardening/shopping-api.test.ts`
- `src/proxy.test.ts`

## 13) Milestone 12 Security (implemented)

Documents are **Private** or **Household Shared** (same classification as §2). M12 does not weaken M1–M11 RLS.

### Enforced

1. Metadata tables have RLS enabled. Anonymous: deny. Authenticated PRIVATE: uploader only. HOUSEHOLD_SHARED: `is_household_member(household_id)` only.
2. Storage bucket `documents` is **private**. No public object URLs. Path matches visibility (`user/{auth.uid()}/...` or `household/{householdId}/...` with membership).
3. View/download uses a short-lived **signed URL** issued only after the caller can `SELECT` the metadata row. Guessing a storage path or document UUID is IDOR → 404, not 403 leak.
4. Create/update/delete: authenticated + visibility pairing + household membership for SHARED. Link insert requires access to **both** the document and the target (existing task/event/chore/list/finance RLS). Cross-household attach is denied by that pair of checks.
5. Mime allowlist and max size (10MB) before upload. Filenames are sanitized; the API does not accept client-supplied `storage_path`.
6. Runtime uses the authenticated Supabase client. **No service-role** in browser or user route handlers.
7. Do not log file bytes; handlers return ids/status only.
8. `current_user_can_access_finance_record` remains **ungranted** to `authenticated`. `current_user_can_access_document_entity` **is** `GRANT EXECUTE` to `authenticated` because attachment RLS policies invoke it (returns boolean using `auth.uid()`; equivalent to probing the entity tables under RLS).
9. Search of document titles is out of M12; `/api/search` is unchanged.
10. SW does not cache-first document API or signed URLs (`/api/*` skipped).

### Verification (automated in-repo; live two-user RLS still required)

- Partner cannot read a PRIVATE document (API tests + `canAccessDocument`).
- Other household cannot read a SHARED document when RLS yields none.
- Unauthenticated list/get/upload/sign → 401.
- Inaccessible id → 404.
- Mime/size rejection → 400.
- Inaccessible entity attach → 404.
- Regression: M8–M11 authorization tests still pass.

Live apply of `drizzle/0011` on hosted Supabase is **not verified** in this environment.
