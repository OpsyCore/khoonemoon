import { describe, expect, it } from "vitest";
import { describeValue, validateEnv } from "./deploy-check.mjs";

const GOOD = {
  NEXT_PUBLIC_SUPABASE_URL: "https://isfzuxrkzeeeggvfcoah.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(60),
  NEXT_PUBLIC_APP_URL: "https://khoonemoon.example.com",
};

describe("validateEnv", () => {
  it("passes with the three required variables", () => {
    const result = validateEnv(GOOD);

    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("reports each missing required variable with its hint", () => {
    const result = validateEnv({});

    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0]).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(result.problems[0]).toContain("https://<ref>.supabase.co");
  });

  it("distinguishes a wrong value from a missing one", () => {
    const result = validateEnv({
      ...GOOD,
      NEXT_PUBLIC_SUPABASE_URL: "http://nope",
    });

    expect(
      result.required.find((item) => item.name === "NEXT_PUBLIC_SUPABASE_URL")
        ?.status,
    ).toBe("set-but-wrong");
    expect(result.problems[0]).toContain("باید با https:// شروع شود");
  });

  it("rejects a short anon key as a probable wrong key", () => {
    const result = validateEnv({
      ...GOOD,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "short",
    });

    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain("کلید بیش از حد کوتاه");
  });

  it("treats optional variables as warnings, not failures", () => {
    const result = validateEnv(GOOD);

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("کار نمی‌کند");
  });

  it("does not warn for a correctly set optional variable", () => {
    const result = validateEnv({
      ...GOOD,
      CRON_SECRET: "a".repeat(32),
      VAPID_SUBJECT: "mailto:hello@example.com",
    });

    const names = result.warnings.map((warning) => warning.split(" ")[0]);
    expect(names).not.toContain("CRON_SECRET");
    expect(names).not.toContain("VAPID_SUBJECT");
  });

  it("warns when a service role key looks too short", () => {
    const result = validateEnv({ ...GOOD, SUPABASE_SERVICE_ROLE_KEY: "abc" });

    expect(result.warnings.join(" ")).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("ignores whitespace-only values", () => {
    const result = validateEnv({ ...GOOD, CRON_SECRET: "   " });

    expect(result.warnings.join(" ")).toContain("CRON_SECRET");
  });
});

describe("describeValue", () => {
  it("never echoes the value, only whether it is set", () => {
    expect(describeValue("super-secret-value")).toBe("تنظیم شده (18 کاراکتر)");
    expect(describeValue("")).toBe("تنظیم نشده");
  });
});
