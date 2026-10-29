import { describe, expect, it } from "vitest";
import {
  activityDate,
  DEFAULT_LEDGER_FILTERS,
  filterLedger,
  hasLedgerFilters,
  ledgerDate,
  matchesLedgerFilters,
  parseLedgerFilters,
  toLedgerQuery,
  type LedgerFilters,
} from "@/features/finance/ledger";
import type { FinancialRecord } from "@/features/finance/types";

const NOW = new Date("2026-10-29T12:00:00.000Z");

function record(overrides: Partial<FinancialRecord> = {}): FinancialRecord {
  return {
    id: "r-1",
    household_id: "h-1",
    owner_id: "u-1",
    created_by: "u-1",
    visibility: "HOUSEHOLD_SHARED",
    record_type: "EXPENSE",
    title: "خرید هفتگی",
    amount: 100_000,
    currency: "IRR",
    category: null,
    note: null,
    occurred_at: "2026-10-28T09:00:00.000Z",
    due_at: null,
    bill_status: null,
    is_recurring: false,
    recurrence_rule: null,
    paid_by: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-10-28T09:00:00.000Z",
    updated_at: "2026-10-28T09:00:00.000Z",
    ...overrides,
  };
}

const ALL: LedgerFilters = DEFAULT_LEDGER_FILTERS;

describe("parseLedgerFilters", () => {
  it("returns defaults for an empty query", () => {
    expect(parseLedgerFilters(new URLSearchParams())).toEqual(ALL);
  });

  it("reads valid values", () => {
    const filters = parseLedgerFilters(
      new URLSearchParams("type=BILL&paid=UNPAID&days=90&q=برق"),
    );

    expect(filters).toEqual({
      type: "BILL",
      paid: "UNPAID",
      days: "90",
      query: "برق",
    });
  });

  it("ignores unknown values instead of throwing", () => {
    const filters = parseLedgerFilters(
      new URLSearchParams("type=SPACESHIP&paid=MAYBE&days=7"),
    );

    expect(filters).toEqual(ALL);
  });

  it("accepts lowercase type values", () => {
    expect(parseLedgerFilters(new URLSearchParams("type=income")).type).toBe(
      "INCOME",
    );
  });
});

describe("toLedgerQuery / hasLedgerFilters", () => {
  it("omits defaults", () => {
    expect(toLedgerQuery(ALL)).toBe("");
    expect(hasLedgerFilters(ALL)).toBe(false);
  });

  it("round-trips the filters", () => {
    const filters: LedgerFilters = {
      type: "BILL",
      paid: "PAID",
      days: "30",
      query: "اینترنت",
    };

    expect(
      parseLedgerFilters(new URLSearchParams(toLedgerQuery(filters))),
    ).toEqual(filters);
    expect(hasLedgerFilters(filters)).toBe(true);
  });
});

describe("ledgerDate", () => {
  it("prefers paid_at, then due_at, then occurred_at", () => {
    expect(
      ledgerDate({
        paid_at: "2026-10-20T00:00:00.000Z",
        due_at: "2026-10-10T00:00:00.000Z",
        occurred_at: "2026-10-01T00:00:00.000Z",
      })?.toISOString(),
    ).toBe("2026-10-20T00:00:00.000Z");

    expect(
      ledgerDate({
        paid_at: null,
        due_at: "2026-10-10T00:00:00.000Z",
        occurred_at: "2026-10-01T00:00:00.000Z",
      })?.toISOString(),
    ).toBe("2026-10-10T00:00:00.000Z");
  });

  it("returns null for a missing or broken date", () => {
    expect(
      ledgerDate({ paid_at: null, due_at: null, occurred_at: "nope" }),
    ).toBeNull();
  });
});

describe("activityDate", () => {
  it("ignores the due date so an upcoming bill does not lead the ledger", () => {
    const bill = {
      paid_at: null,
      occurred_at: "2026-10-15T00:00:00.000Z",
    };

    expect(activityDate(bill)?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("prefers the payment date", () => {
    expect(
      activityDate({
        paid_at: "2026-10-28T00:00:00.000Z",
        occurred_at: "2026-10-01T00:00:00.000Z",
      })?.toISOString(),
    ).toBe("2026-10-28T00:00:00.000Z");
  });

  it("returns null for a broken date", () => {
    expect(activityDate({ paid_at: null, occurred_at: "nope" })).toBeNull();
  });
});

describe("matchesLedgerFilters", () => {
  it("always hides archived records", () => {
    expect(
      matchesLedgerFilters({
        record: record({ archived_at: "2026-10-01T00:00:00.000Z" }),
        filters: ALL,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("filters by type", () => {
    expect(
      matchesLedgerFilters({
        record: record({ record_type: "BILL" }),
        filters: { ...ALL, type: "EXPENSE" },
        now: NOW,
      }),
    ).toBe(false);
  });

  it("filters by paid state", () => {
    const paid = record({ paid_at: "2026-10-28T00:00:00.000Z" });

    expect(
      matchesLedgerFilters({
        record: paid,
        filters: { ...ALL, paid: "UNPAID" },
        now: NOW,
      }),
    ).toBe(false);
    expect(
      matchesLedgerFilters({
        record: paid,
        filters: { ...ALL, paid: "PAID" },
        now: NOW,
      }),
    ).toBe(true);
  });

  it("filters by day range using the ledger date", () => {
    const old = record({ occurred_at: "2026-01-01T00:00:00.000Z" });

    expect(
      matchesLedgerFilters({
        record: old,
        filters: { ...ALL, days: "30" },
        now: NOW,
      }),
    ).toBe(false);
    expect(matchesLedgerFilters({ record: old, filters: ALL, now: NOW })).toBe(
      true,
    );
  });

  it("excludes undated records from a dated view", () => {
    const undated = record({
      paid_at: null,
      due_at: null,
      occurred_at: "garbage",
    });

    expect(
      matchesLedgerFilters({
        record: undated,
        filters: { ...ALL, days: "90" },
        now: NOW,
      }),
    ).toBe(false);
  });

  it("searches title, category and note case-insensitively", () => {
    const target = record({
      title: "قبض برق",
      category: "خانه",
      note: "پرداخت آنلاین",
    });

    for (const query of ["برق", "خانه", "آنلاین"]) {
      expect(
        matchesLedgerFilters({
          record: target,
          filters: { ...ALL, query },
          now: NOW,
        }),
      ).toBe(true);
    }

    expect(
      matchesLedgerFilters({
        record: target,
        filters: { ...ALL, query: "گاز" },
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does not crash on a record without category or note", () => {
    expect(
      matchesLedgerFilters({
        record: record({ category: null, note: null }),
        filters: { ...ALL, query: "خرید" },
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("filterLedger", () => {
  const records = [
    record({
      id: "old",
      occurred_at: "2026-10-01T00:00:00.000Z",
      amount: 50_000,
    }),
    record({
      id: "new",
      occurred_at: "2026-10-27T00:00:00.000Z",
      amount: 120_000,
    }),
    record({
      id: "income",
      record_type: "INCOME",
      occurred_at: "2026-10-20T00:00:00.000Z",
      amount: 900_000,
    }),
    record({
      id: "bill",
      record_type: "BILL",
      occurred_at: "2026-10-15T00:00:00.000Z",
      amount: 300_000,
      due_at: "2026-11-05T00:00:00.000Z",
    }),
  ];

  it("returns newest first", () => {
    const { records: matched } = filterLedger({
      records,
      filters: ALL,
      now: NOW,
    });

    expect(matched.map((entry) => entry.id)).toEqual([
      "new",
      "income",
      "bill",
      "old",
    ]);
  });

  it("summarises income, expense and unpaid bills", () => {
    const { summary } = filterLedger({ records, filters: ALL, now: NOW });

    expect(summary.count).toBe(4);
    expect(summary.income).toBe(900_000);
    expect(summary.expense).toBe(470_000);
    expect(summary.outstanding).toBe(300_000);
  });

  it("respects a paid filter in the summary", () => {
    const { records: matched, summary } = filterLedger({
      records: [
        ...records,
        record({
          id: "paid-bill",
          record_type: "BILL",
          amount: 70_000,
          paid_at: "2026-10-29T00:00:00.000Z",
        }),
      ],
      filters: { ...ALL, paid: "PAID" },
      now: NOW,
    });

    expect(matched.map((entry) => entry.id)).toEqual(["paid-bill"]);
    // A paid bill is not outstanding.
    expect(summary.outstanding).toBe(0);
  });

  it("returns an empty result and zeroed summary when nothing matches", () => {
    const result = filterLedger({
      records,
      filters: { ...ALL, query: "ناموجود" },
      now: NOW,
    });

    expect(result.records).toEqual([]);
    expect(result.summary).toMatchObject({ count: 0, income: 0, expense: 0 });
  });

  it("carries the currency of the first match", () => {
    const result = filterLedger({
      records: [record({ currency: "USD" })],
      filters: ALL,
      now: NOW,
    });

    expect(result.summary.currency).toBe("USD");
  });
});
