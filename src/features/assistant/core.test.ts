import { describe, expect, it } from "vitest";
import {
  freeModelIsApproved,
  normalizePersianText,
  parseInternalIntent,
  toLocalDateTimeIso,
} from "./core";

describe("Persian assistant intent router", () => {
  it.each([
    ["سلام، امروز چه کارهایی دارم؟", "today_tasks"],
    ["یادآوری‌های نزدیک من", "upcoming_reminders"],
    ["رویدادهای تقویم این هفته", "calendar_events"],
    ["لیست خرید را نشان بده", "shopping_list"],
    ["برنامه غذایی این هفته چیه؟", "meal_plan"],
    ["قبض‌های نزدیک سررسید", "upcoming_bills"],
    ["کدام مدرک نزدیک انقضا است؟", "expiring_documents"],
    ["زمان سرویس وسایل خانه", "maintenance_schedule"],
    ["موجودی یخچال چطوره؟", "unsupported_inventory"],
    ["چی بپزم؟", "unsupported_meal_suggestion"],
    ["اینترنت چطور کار می‌کند؟", "unknown"],
  ] as const)("routes %s to %s", (message, expected) => {
    expect(parseInternalIntent(message).intent).toBe(expected);
  });

  it("normalizes Arabic/Persian letters, numerals, and joiners", () => {
    expect(normalizePersianText("يادآورِ فردا ساعت ۰۹:۳۰ كجاست؟")).toBe(
      "یادآور فردا ساعت 09:30 کجاست؟".toLocaleLowerCase("fa-IR"),
    );
  });

  it("extracts simple write intent text only for explicit commands", () => {
    expect(
      parseInternalIntent("به لیست خرید اضافه کن: شیر کم‌چرب"),
    ).toMatchObject({
      intent: "add_shopping_item",
      shoppingItemName: "شیر کم چرب",
    });
    expect(parseInternalIntent("کار جدید: آب‌دادن گل‌ها")).toMatchObject({
      intent: "create_household_task",
      taskTitle: "آب دادن گل ها",
    });
    expect(
      parseInternalIntent("یادآور برای خرید نان فردا ساعت ۹:۱۵ تنظیم کن"),
    ).toMatchObject({
      intent: "create_reminder",
      reminderTargetTitle: "خرید نان",
      reminderDate: "tomorrow",
      reminderTime: "09:15",
    });
  });

  it("requires an exact free-price catalog entry and an approved ID", () => {
    const catalog = [
      {
        id: "org/model:free",
        promptPrice: "0",
        completionPrice: "0",
        supportedParameters: ["response_format"],
      },
      {
        id: "org/paid",
        promptPrice: "0.0001",
        completionPrice: "0.0002",
        supportedParameters: ["response_format"],
      },
      {
        id: "org/unknown",
        promptPrice: undefined,
        completionPrice: "0",
        supportedParameters: ["response_format"],
      },
    ];
    expect(
      freeModelIsApproved("org/model:free", ["org/model:free"], catalog),
    ).toBe(true);
    expect(freeModelIsApproved("org/paid", ["org/paid"], catalog)).toBe(false);
    expect(freeModelIsApproved("org/unknown", ["org/unknown"], catalog)).toBe(
      false,
    );
    expect(freeModelIsApproved("org/model:free", [], catalog)).toBe(false);
  });

  it("converts local times correctly across timezone date boundaries", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    expect(toLocalDateTimeIso("tomorrow", "09:30", "Asia/Tehran", now)).toBe(
      "2026-01-02T06:00:00.000Z",
    );
    // At UTC+14 this instant is already the next local calendar day.
    expect(
      toLocalDateTimeIso("tomorrow", "09:30", "Pacific/Kiritimati", now),
    ).toBe("2026-01-02T19:30:00.000Z");
  });
});
