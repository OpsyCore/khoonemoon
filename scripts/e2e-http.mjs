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
 *   the export route  → 401 too: it returns every visible row in one request
 *
 * Usage: npm run build && npm run e2e:http
 */
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 4311);
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 45_000;

/**
 * Hard ceiling for the whole run. In CI a hung `fetch` (a server that accepts the
 * connection but never answers) would otherwise sit there for the job's lifetime;
 * the watchdog guarantees a failing exit code instead of a silently stuck step.
 */
const HARD_TIMEOUT_MS = 150_000;

/** Per-request ceiling, so one unresponsive route cannot swallow the budget. */
const REQUEST_TIMEOUT_MS = 10_000;

const watchdog = setTimeout(() => {
  console.error(
    `\n✖ اجرای e2e پس از ${HARD_TIMEOUT_MS / 1000} ثانیه متوقف شد (سرور پاسخ نداد).`,
  );
  console.error(serverLog.slice(-2000));
  stopServer();
  process.exit(1);
}, HARD_TIMEOUT_MS);
// Do not keep the process alive just for the watchdog.
watchdog.unref();

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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  // The export hands out every row the caller can see; a missing guard here is
  // a bulk data leak, not a cosmetic 500.
  { path: "/api/export", method: "GET" },
  { path: "/api/documents", method: "GET" },
];

/**
 * Run Next's own binary, not `npx next`.
 *
 * `npx` spawns Next as a grandchild, so killing the handle we hold leaves the
 * real server orphaned and still bound to the port — the next run then talks to
 * a stale build, or hangs. `detached` + a negative pid kills the whole group.
 */
const NEXT_BIN = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const server = spawn(
  process.execPath,
  [NEXT_BIN, "start", "--port", String(PORT), "--hostname", "127.0.0.1"],
  {
    detached: process.platform !== "win32",
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

server.on("error", (error) => {
  console.error(`✖ اجرای سرور ممکن نشد: ${error.message}`);
  process.exit(1);
});

function stopServer() {
  if (server.exitCode !== null) return;

  try {
    // Negative pid = the whole process group, so no orphan keeps the port.
    if (process.platform !== "win32") process.kill(-server.pid, "SIGTERM");
    else server.kill("SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }

  setTimeout(() => {
    try {
      if (process.platform !== "win32") process.kill(-server.pid, "SIGKILL");
      else server.kill("SIGKILL");
    } catch {
      // already gone
    }
  }, 3000).unref();
}

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

try {
  // A leftover server on this port would make every assertion meaningless, so
  // refuse to run instead of reporting on someone else's process.
  try {
    await fetch(`${BASE}/auth/login`, {
      redirect: "manual",
      signal: AbortSignal.timeout(2000),
    });
    console.error(
      `✖ پورت ${PORT} از قبل اشغال است. یک سرور قبلی را ببندید یا E2E_PORT را عوض کنید.`,
    );
    process.exit(1);
  } catch {
    // nothing listening — what we want
  }

  console.log(`اجرای build روی پورت ${PORT}…`);

  if (!(await waitForServer())) {
    console.error("✖ سرور در زمان مقرر بالا نیامد.\n");
    console.error(serverLog.slice(-2000));
    stopServer();
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

  // Native form submission before React hydrates must not expose credentials
  // in the URL or browser history. POST is a safe fallback, even if it fails.
  // Login is rendered behind a client-side Suspense boundary; it is tested
  // separately by rendering LoginForm with a mocked router.
  for (const route of ["signup", "forgot-password", "update-password"]) {
    await expectStatus({
      name: `روش امن فرم ${route}`,
      path: `/auth/${route}`,
      status: 200,
      contains: 'method="post"',
    });
  }

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

  await expectStatus({
    name: "مدارک بدون نشست → هدایت",
    path: "/documents",
    status: [307, 302],
  });

  console.log("\nگاردهای API (بدون نشست)");
  for (const testCase of guardCases) {
    await expectStatus({
      name: `${testCase.method} ${testCase.path}`,
      path: testCase.path,
      status: 401,
      init:
        testCase.method === "GET"
          ? { method: "GET" }
          : {
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

// `main` is implicit here (top-level await), so the exit code must be set
// explicitly: a lingering child process would otherwise keep the step alive.
