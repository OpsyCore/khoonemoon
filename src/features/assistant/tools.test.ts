import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canShare, runAssistantTool } from "./tools";

const context = {
  client: {} as SupabaseClient,
  userId: "60000000-0000-4000-8000-000000000031",
  householdId: null,
  timeZone: "Asia/Tehran",
  message: "",
  now: new Date("2026-10-28T12:00:00Z"),
};

describe("assistant tool safety boundaries", () => {
  it("defaults to private and requires an explicit positive shared request", () => {
    expect(canShare("کار جدید: آب دادن گل‌ها")).toBe(false);
    expect(canShare("کار جدید مشترک: خرید نان")).toBe(true);
    expect(canShare("کار جدید خانوادگی: تمیزکاری")).toBe(true);
    expect(canShare("کار غیرمشترک: قبض را بررسی کن")).toBe(false);
    expect(canShare("کار مشترک نباشد: قبض را بررسی کن")).toBe(false);
    expect(canShare("کار خصوصی برای همه اعضای خانه")).toBe(false);
    expect(canShare("نه برای همه اعضای خانه")).toBe(false);
  });

  it("does not fabricate inventory or meal suggestions", async () => {
    const inventory = await runAssistantTool(
      { intent: "unsupported_inventory" },
      context,
    );
    const meal = await runAssistantTool(
      { intent: "unsupported_meal_suggestion" },
      context,
    );
    expect(inventory.text).toContain("موجودی واقعی خانه نیست");
    expect(meal.text).toContain("سرویس پیشنهاد غذا");
  });

  it("requires a household before reading the household shopping list", async () => {
    const result = await runAssistantTool({ intent: "shopping_list" }, context);
    expect(result.text).toContain("ابتدا وارد یک خانه شو");
  });

  it("does not make a write proposal without configured server signing", async () => {
    const result = await runAssistantTool(
      { intent: "create_household_task", taskTitle: "آبیاری گل‌ها" },
      { ...context, message: "کار جدید: آبیاری گل‌ها" },
    );
    expect(result.action).toBeUndefined();
    expect(result.text).toContain("هیچ تغییری ذخیره نشد");
  });
});
