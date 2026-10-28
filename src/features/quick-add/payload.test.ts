import { describe, expect, it } from "vitest";
import { createEventSchema } from "@/features/calendar/schemas";
import { createFinancialRecordSchema } from "@/features/finance/schemas";
import { createTaskSchema } from "@/features/tasks/schemas";
import {
  buildQuickBillPayload,
  buildQuickChorePayload,
  buildQuickEventPayload,
  buildQuickShoppingPayload,
  buildQuickTaskPayload,
  defaultEventWindow,
  fromDateTimeLocal,
  parseAmount,
  toDateTimeLocal,
} from "./payload";

describe("parseAmount", () => {
  it("reads plain digits", () => {
    expect(parseAmount("450000")).toBe(450000);
  });

  it("reads Persian digits with separators", () => {
    expect(parseAmount("۴۵۰٬۰۰۰")).toBe(450000);
  });

  it("reads Arabic digits", () => {
    expect(parseAmount("١٢٠٠")).toBe(1200);
  });

  it("strips common separators and spaces", () => {
    expect(parseAmount(" 1,250,000 ")).toBe(1250000);
  });

  it("rejects empty and invalid input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("datetime helpers", () => {
  it("round-trips a local datetime value", () => {
    const value = toDateTimeLocal(new Date("2026-11-02T09:30:00.000Z"));
    const iso = fromDateTimeLocal(value);

    expect(iso).not.toBeNull();
    expect(new Date(iso as string).getTime()).toBe(
      new Date("2026-11-02T09:30:00.000Z").getTime(),
    );
  });

  it("returns null for empty input", () => {
    expect(fromDateTimeLocal("")).toBeNull();
  });
});

describe("defaultEventWindow", () => {
  it("starts at the next full hour and lasts one hour", () => {
    const { start, end } = defaultEventWindow(
      new Date("2026-10-28T10:23:00"),
    );

    expect(start.getMinutes()).toBe(0);
    expect(start.getHours()).toBe(11);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });
});

describe("payload builders satisfy the server schemas", () => {
  it("task payload passes createTaskSchema", () => {
    const parsed = createTaskSchema.safeParse(
      buildQuickTaskPayload({
        title: "خرید نان",
        visibility: "HOUSEHOLD_SHARED",
        dueAt: "2026-10-29T08:00:00.000Z",
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("task payload works without a due date", () => {
    const parsed = createTaskSchema.safeParse(
      buildQuickTaskPayload({ title: "تماس با مامان", visibility: "PRIVATE" }),
    );

    expect(parsed.success).toBe(true);
  });

  it("event payload passes createEventSchema", () => {
    const { start, end } = defaultEventWindow(new Date("2026-10-28T10:00:00"));
    const parsed = createEventSchema.safeParse(
      buildQuickEventPayload({
        title: "دکتر",
        visibility: "HOUSEHOLD_SHARED",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("event payload is rejected when the end precedes the start", () => {
    const parsed = createEventSchema.safeParse(
      buildQuickEventPayload({
        title: "دکتر",
        visibility: "PRIVATE",
        startAt: "2026-10-28T12:00:00.000Z",
        endAt: "2026-10-28T11:00:00.000Z",
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("bill payload passes createFinancialRecordSchema", () => {
    const parsed = createFinancialRecordSchema.safeParse(
      buildQuickBillPayload({
        title: "قبض آب",
        amount: 320000,
        visibility: "HOUSEHOLD_SHARED",
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("bill payload trims the title", () => {
    const payload = buildQuickBillPayload({
      title: "  قبض آب  ",
      amount: 1000,
      visibility: "PRIVATE",
    });

    expect(payload.title).toBe("قبض آب");
  });

  it("shopping payload keeps the list id and trimmed name", () => {
    const payload = buildQuickShoppingPayload({
      name: "  ماست ",
      listId: "00000000-0000-4000-8000-0000000000d1",
    });

    expect(payload.name).toBe("ماست");
    expect(payload.quantity).toBeNull();
  });

  it("chore payload defaults to a fixed weekly assignment", () => {
    const payload = buildQuickChorePayload({
      title: "ظرف‌ها",
      frequency: "WEEKLY",
    });

    expect(payload.rotationMode).toBe("FIXED");
    expect(payload.frequency).toBe("WEEKLY");
    expect(payload.assigneeIds).toEqual([]);
  });
});
