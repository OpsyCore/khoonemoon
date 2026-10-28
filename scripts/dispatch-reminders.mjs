#!/usr/bin/env node
/**
 * Triggers `POST /api/reminders/dispatch` with the cron secret.
 *
 * Used by `.github/workflows/reminder-dispatch.yml`, and runnable by hand:
 *
 *   APP_BASE_URL=https://app.example.com CRON_SECRET=... node scripts/dispatch-reminders.mjs
 *
 * Exits 0 only when the endpoint answered 2xx, so a silently broken scheduler
 * shows up as a red workflow instead of missed reminders nobody notices.
 */

const baseUrl = (process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
const secret = (process.env.CRON_SECRET ?? "").trim();
const timeoutMs = Number(process.env.DISPATCH_TIMEOUT_MS ?? 30_000);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!baseUrl) fail("APP_BASE_URL تنظیم نشده است.");
if (!secret) fail("CRON_SECRET تنظیم نشده است.");

if (!/^https?:\/\//.test(baseUrl)) {
  fail(`APP_BASE_URL باید با http:// یا https:// شروع شود (مقدار: ${baseUrl}).`);
}

const url = `${baseUrl}/api/reminders/dispatch`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    // The endpoint reads nothing from the body, but an explicit `{}` keeps
    // proxies from rejecting a POST without a payload.
    body: "{}",
    signal: controller.signal,
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.message ?? text.slice(0, 300);
    fail(`پاسخ ${response.status} از ${url} — ${detail}`);
  }

  const summary = payload?.summary ?? payload;

  console.log(`✔ ${url} → ${response.status}`);
  if (summary) console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  if (error?.name === "AbortError") {
    fail(`درخواست پس از ${timeoutMs} میلی‌ثانیه بی‌پاسخ ماند.`);
  }

  fail(`درخواست ناموفق بود: ${error?.message ?? error}`);
} finally {
  clearTimeout(timer);
}
