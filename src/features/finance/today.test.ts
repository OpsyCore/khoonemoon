import { describe, expect, it } from "vitest";
import { buildPayAction } from "@/features/finance/components/finance-payload";
import { buildTodayBillItems, filterTodayBillsAfterPay } from "./today";
import type { FinanceRecord } from "./types";

const now = new Date("2026-08-27T12:00:00.000");

function record(
  overrides: Partial<FinanceRecord> & Pick<FinanceRecord, "id" | "title">,
): FinanceRecord {
  return {
    record_type: "BILL",
    amount: 100,
    currency: "IRR",
    owner_id: "user-a",
    created_by: "user-a",
    household_id: "h1",
    visibility: "HOUSEHOLD_SHARED",
    due_at: null,
    occurred_at: null,
    paid_at: null,
    paid_by: null,
    category: null,
    note: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildTodayBillItems", () => {
  it("includes an unpaid bill due yesterday", () => {
    const items = buildTodayBillItems(
      [record({ id: "overdue", title: "برق", due_at: "2026-08-26T12:00:00.000" })],
      now,
    );
    expect(items.map((item) => item.id)).toEqual(["overdue"]);
    expect(items[0]?.overdue).toBe(true);
    expect(items[0]?.status).toBe("OVERDUE");
  });

  it("includes an unpaid bill due earlier today", () => {
    const items = buildTodayBillItems(
      [record({ id: "due-am", title: "آب", due_at: "2026-08-27T08:00:00.000" })],
      now,
    );
    expect(items.map((item) => item.id)).toEqual(["due-am"]);
    expect(items[0]?.overdue).toBe(false);
    expect(items[0]?.status).toBe("DUE");
  });

  it("includes an unpaid bill due later today", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "due-pm",
          title: "اینترنت",
          due_at: "2026-08-27T18:00:00.000",
        }),
      ],
      now,
    );
    expect(items.map((item) => item.id)).toEqual(["due-pm"]);
  });

  it("excludes an unpaid bill due tomorrow", () => {
    const items = buildTodayBillItems(
      [record({ id: "upcoming", title: "اجاره", due_at: "2026-08-28T09:00:00.000" })],
      now,
    );
    expect(items).toEqual([]);
  });

  it("excludes a paid bill", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "paid",
          title: "گاز",
          due_at: "2026-08-27T09:00:00.000",
          paid_at: "2026-08-26T09:00:00.000Z",
          paid_by: "user-a",
        }),
      ],
      now,
    );
    expect(items).toEqual([]);
  });

  it("excludes expenses", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "expense",
          title: "نان",
          record_type: "EXPENSE",
          due_at: null,
          occurred_at: "2026-08-27T09:00:00.000",
          household_id: null,
          visibility: "PRIVATE",
        }),
      ],
      now,
    );
    expect(items).toEqual([]);
  });

  it("filters a mixed overdue/due/future/paid/expense list", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "upcoming",
          title: "اجاره",
          due_at: "2026-09-01T09:00:00.000",
        }),
        record({
          id: "paid",
          title: "گاز",
          due_at: "2026-08-27T09:00:00.000",
          paid_at: "2026-08-26T09:00:00.000Z",
          paid_by: "user-a",
        }),
        record({
          id: "expense",
          title: "نان",
          record_type: "EXPENSE",
          due_at: null,
          occurred_at: "2026-08-27T09:00:00.000",
        }),
        record({
          id: "due-late",
          title: "اینترنت",
          due_at: "2026-08-27T18:00:00.000",
        }),
        record({
          id: "overdue",
          title: "برق",
          due_at: "2026-08-10T09:00:00.000",
        }),
      ],
      now,
    );

    expect(items.map((item) => item.id)).toEqual(["overdue", "due-late"]);
  });

  it("sorts overdue before due, then by due_at ascending", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "due-late",
          title: "اینترنت",
          due_at: "2026-08-27T18:00:00.000",
        }),
        record({
          id: "due-early",
          title: "آب",
          due_at: "2026-08-27T08:00:00.000",
        }),
        record({
          id: "overdue-later",
          title: "گاز",
          due_at: "2026-08-20T12:00:00.000",
        }),
        record({
          id: "overdue-earlier",
          title: "برق",
          due_at: "2026-08-10T09:00:00.000",
        }),
      ],
      now,
    );

    expect(items.map((item) => item.id)).toEqual([
      "overdue-earlier",
      "overdue-later",
      "due-early",
      "due-late",
    ]);
    expect(items[0]?.overdue).toBe(true);
    expect(items[2]?.overdue).toBe(false);
  });

  it("does not mutate the input array", () => {
    const input = [
      record({
        id: "due-late",
        title: "اینترنت",
        due_at: "2026-08-27T18:00:00.000",
      }),
      record({
        id: "overdue",
        title: "برق",
        due_at: "2026-08-10T09:00:00.000",
      }),
    ];
    const snapshot = input.map((item) => item.id);

    Object.freeze(input);
    buildTodayBillItems(input, now);

    expect(input.map((item) => item.id)).toEqual(snapshot);
  });

  it("returns an empty list for empty input", () => {
    expect(buildTodayBillItems([], now)).toEqual([]);
  });

  it("keeps input order when due_at values are identical", () => {
    const dueAt = "2026-08-27T10:00:00.000";
    const items = buildTodayBillItems(
      [
        record({ id: "second", title: "ب", due_at: dueAt }),
        record({ id: "first", title: "آ", due_at: dueAt }),
      ],
      now,
    );

    expect(items.map((item) => item.id)).toEqual(["second", "first"]);
  });
});

describe("today pay", () => {
  it("sends exactly { action: \"pay\" }", () => {
    expect(buildPayAction()).toEqual({ action: "pay" });
    expect(JSON.stringify(buildPayAction())).toBe('{"action":"pay"}');
  });

  it("removes a bill from Today only after successful pay", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "due-am",
          title: "آب",
          due_at: "2026-08-27T08:00:00.000",
        }),
        record({
          id: "overdue",
          title: "برق",
          due_at: "2026-08-10T09:00:00.000",
        }),
      ],
      now,
    );

    expect(
      filterTodayBillsAfterPay(items, "due-am", true).map((item) => item.id),
    ).toEqual(["overdue"]);
  });

  it("does not remove a bill when pay fails", () => {
    const items = buildTodayBillItems(
      [
        record({
          id: "due-am",
          title: "آب",
          due_at: "2026-08-27T08:00:00.000",
        }),
      ],
      now,
    );

    expect(filterTodayBillsAfterPay(items, "due-am", false)).toEqual(items);
  });
});
