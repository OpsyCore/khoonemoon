import { describe, expect, it } from "vitest";
import { profileSchema } from "@/features/profile/schema";

describe("profile schema", () => {
  it("rejects empty profile name", () => {
    const result = profileSchema.safeParse({
      full_name: "",
      timezone: "Asia/Tehran",
      locale: "fa-IR",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid profile payload", () => {
    const result = profileSchema.safeParse({
      full_name: "نگار احمدی",
      timezone: "Asia/Tehran",
      locale: "fa-IR",
    });

    expect(result.success).toBe(true);
  });
  it("rejects invalid time zones and language tags", () => {
    expect(
      profileSchema.safeParse({
        full_name: "نگار",
        timezone: "Not/AZone",
        locale: "fa-IR",
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        full_name: "نگار",
        timezone: "Asia/Tehran",
        locale: "not_a_locale",
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        full_name: "نگار",
        timezone: "+03:30",
        locale: "fa-IR",
      }).success,
    ).toBe(false);
  });
  it("normalizes case and accepts valid zones and language tags", () => {
    const result = profileSchema.parse({
      full_name: " نگار ",
      timezone: "asia/tehran",
      locale: "fa-ir",
    });
    expect(result).toEqual({
      full_name: "نگار",
      timezone: "Asia/Tehran",
      locale: "fa-IR",
    });
    expect(
      profileSchema.safeParse({
        full_name: "نگار",
        timezone: "UTC",
        locale: "en-US",
      }).success,
    ).toBe(true);
  });
});
