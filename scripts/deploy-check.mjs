import path from "node:path";

const REQUIRED = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "https://<ref>.supabase.co",
    check: (value) => /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(value),
    problem: "باید با https:// شروع شود و به .supabase.co ختم شود.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hint: "anon key از داشبورد Supabase",
    check: (value) => value.length > 40,
    problem: "کلید بیش از حد کوتاه است؛ احتمالاً کلید اشتباهی گذاشته شده.",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    hint: "https://<domain>",
    check: (value) => /^https?:\/\/[^\s]+$/.test(value),
    problem: "باید یک URL کامل باشد.",
  },
];

const OPTIONAL = [
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    feature: "ارسال زمان‌بندی‌شدهٔ یادآور برای همهٔ کاربران",
    check: (value) => value.length > 40,
  },
  {
    name: "CRON_SECRET",
    feature: "احراز هویت زمان‌بند یادآورها",
    check: (value) => value.length >= 16,
  },
  {
    name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    feature: "Web Push",
    check: (value) => value.length > 40,
  },
  {
    name: "VAPID_PRIVATE_KEY",
    feature: "Web Push",
    check: (value) => value.length > 20,
  },
  {
    name: "VAPID_SUBJECT",
    feature: "شناسهٔ تماس با سرویس push",
    check: (value) => /^(mailto:|https?:)/.test(value),
  },
  {
    name: "DATABASE_URL",
    feature: "بررسی اتصال مستقیم دیتابیس در /api/health",
    check: (value) => /^postgres(ql)?:\/\//.test(value),
  },
];

/**
 * Pure so it can be tested: takes the environment, returns findings.
 * `status` is one of `ok` / `set-but-wrong` / `missing`.
 */
export function validateEnv(env) {
  const required = REQUIRED.map((item) => {
    const value = (env[item.name] ?? "").trim();

    if (!value) {
      return {
        ...item,
        status: "missing",
        message: `${item.name} تنظیم نشده است (${item.hint}).`,
      };
    }

    if (!item.check(value)) {
      return {
        ...item,
        status: "set-but-wrong",
        message: `${item.name}: ${item.problem}`,
      };
    }

    return { ...item, status: "ok", message: null };
  });

  const optional = OPTIONAL.map((item) => {
    const value = (env[item.name] ?? "").trim();

    if (!value) {
      return {
        ...item,
        status: "missing",
        message: `${item.name} تنظیم نشده → «${item.feature}» کار نمی‌کند.`,
      };
    }

    if (!item.check(value)) {
      return {
        ...item,
        status: "set-but-wrong",
        message: `${item.name} شکل درستی ندارد → «${item.feature}» ممکن است کار نکند.`,
      };
    }

    return { ...item, status: "ok", message: null };
  });

  const problems = required
    .filter((item) => item.status !== "ok")
    .map((item) => item.message);

  const warnings = optional
    .filter((item) => item.status !== "ok")
    .map((item) => item.message);

  return {
    required,
    optional,
    problems,
    warnings,
    ok: problems.length === 0,
  };
}

/** Never echo a secret; only whether it looks set and its length. */
export function describeValue(value) {
  return value ? `تنظیم شده (${value.length} کاراکتر)` : "تنظیم نشده";
}

function main() {
  const result = validateEnv(process.env);

  console.log("بررسی پیکربندی استقرار");
  console.log("────────────────────────────────────────────");

  for (const item of result.required) {
    const value = (process.env[item.name] ?? "").trim();
    const mark = item.status === "ok" ? "✔" : "✖";
    console.log(`${mark} ${item.name.padEnd(32)} ${describeValue(value)}`);
  }

  for (const item of result.optional) {
    const value = (process.env[item.name] ?? "").trim();
    console.log(
      `${value ? "•" : "○"} ${item.name.padEnd(32)} ${describeValue(value)}`,
    );
  }

  if (result.warnings.length > 0) {
    console.log(
      "\nهشدارها (اپ بالا می‌آید، ولی این قابلیت‌ها غیرفعال می‌مانند):",
    );
    for (const warning of result.warnings) console.log(`  ○ ${warning}`);
  }

  if (!result.ok) {
    console.error("\n✖ پیکربندی ناقص است:");
    for (const problem of result.problems) console.error(`  ${problem}`);
    console.error("\nراهنما: DEPLOYMENT.md → بخش ۲");
    process.exit(1);
  }

  console.log("\n✔ متغیرهای لازم برای بالا آمدن سایت کامل هستند.");
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (invokedDirectly) main();
