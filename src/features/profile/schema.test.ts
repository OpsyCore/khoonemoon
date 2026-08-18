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
});
