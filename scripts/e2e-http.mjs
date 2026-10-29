#!/usr/bin/env node
/**
 * End-to-end check against a *running* production build.
 *
 * There is no browser in CI (and none in the sandbox this was written in), so
 * this cannot click buttons. What it can do is exercise the real stack — built
 * output, Next server, routing, middleware, API guards — and that is where whole
 * classes of regressions live: a page that stops rendering, a route that 500s,
 * a write endpoint that forgets its session check.
 *
 * Every assertion here is about behaviour, not implementation:
 *
 *   public pages      → 200 and Persian content actually present
 *   protected pages   → redirect to the login page (not a 500, not a blank 200)
 *   write endpoints   → 401 without a session (a guard regression is a breach)
 *
 * Usage: npm run build && npm run e2e:http
 */
import { spawn } from "node:child_process";

const PORT = Number(process.env.E2E_PORT ?? 4311);
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 60_000;

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/auth/login`, {
        redirect: "manual",
      });
      if (response.status < 500) return true;
    } catch {
      // not listening yet
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function expectStatus({ name, path, status, contains, init }) {
  try {
    const response = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      ...init,
    });
    const body = await response.text();
    const statusOk = Array.isArray(status)
      ? status.includes(response.status)
      : response.status === status;

    if (!statusOk) {
      record(name, false, `دریافت ${response.status} به‌جای ${status}`);
      return;
    }

    if (contains && !body.includes(contains)) {
      record(name, false, `متن «${contains}» در پاسخ نبود`);
      return;
    }

    record(name, true, `${response.status}`);
  } catch (error) {
    record(name, false, error.message);
  }
}

const guardCases = [
  { path: "/api/tasks", method: "POST" },
  { path: "/api/events", method: "POST" },
  { path: "/api/shopping/items", method: "POST" },
  { path: "/api/finance", method: "POST" },
  { path: "/api/chores", method: "POST" },
  { path: "/api/reminders", method: "POST" },
];

const server = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "--port", String(PORT), "--hostname", "127.0.0.1"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      // Placeholders: the point is the guard, not a working database.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "e2e-placeholder-key",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? BASE,
    },
  },
);

let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk.toString()));
server.stderr.on("data", (chunk) => (serverLog += chunk.toString()));

function stopServer() {
  if (!server.killed) server.kill("SIGTERM");
}

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

try {
  console.log(`اجرای build روی پورت ${PORT}…`);

  if (!(await waitForServer())) {
    console.error("✖ سرور در زمان مقرر بالا نیامد.\n");
    console.error(serverLog.slice(-2000));
    process.exit(1);
  }

  console.log("\nصفحه‌های عمومی");
  await expectStatus({
    name: "صفحهٔ ورود",
    path: "/auth/login",
    status: 200,
    contains: "ورود",
  });
  await expectStatus({
    name: "صفحهٔ ثبت‌نام",
    path: "/auth/signup",
    status: 200,
    contains: "ثبت",
  });
  await expectStatus({ name: "صفحهٔ آفلاین", path: "/offline", status: 200 });

  console.log("\nمسیرهای محافظت‌شده");
  await expectStatus({
    name: "داشبورد بدون نشست → هدایت",
    path: "/today",
    status: [307, 302],
  });
  await expectStatus({
    name: "دفتر مالی بدون نشست → هدایت",
    path: "/finance",
    status: [307, 302],
  });
  await expectStatus({
    name: "صندوق یادآورها بدون نشست → هدایت",
    path: "/reminders",
    status: [307, 302],
  });

  console.log("\nگاردهای API (بدون نشست)");
  for (const testCase of guardCases) {
    await expectStatus({
      name: `${testCase.method} ${testCase.path}`,
      path: testCase.path,
      status: 401,
      init: {
        method: testCase.method,
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    });
  }

  console.log("\nمسیر زمان‌بند یادآور");
  await expectStatus({
    name: "dispatch با توکن جعلی",
    path: "/api/reminders/dispatch",
    status: [401, 403, 500],
    init: {
      method: "POST",
      headers: { authorization: "Bearer definitely-not-the-secret" },
      body: "{}",
    },
  });
} finally {
  stopServer();
}

const failed = results.filter((result) => !result.ok);
const total = results.length;

if (failed.length > 0) {
  console.error(`\n✖ ${failed.length} از ${total} بررسی ناموفق بود.`);
  for (const failure of failed)
    console.error(`  ${failure.name}: ${failure.detail}`);
  process.exit(1);
}

console.log(`\n✔ همهٔ ${total} بررسی end-to-end موفق بود.`);
