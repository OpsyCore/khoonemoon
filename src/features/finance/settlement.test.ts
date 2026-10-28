import { describe, expect, it } from "vitest";
import {
  isSettleableRecord,
  settleHousehold,
  splitEvenly,
  type SettlementMember,
} from "@/features/finance/settlement";
import type { FinancialRecord } from "@/features/finance/types";

const ALI: SettlementMember = { id: "u-ali", name: "علی" };
const SARA: SettlementMember = { id: "u-sara", name: "سارا" };
const REZA: SettlementMember = { id: "u-reza", name: "رضا" };

type PartialRecord = Pick<
  FinancialRecord,
  | "visibility"
  | "record_type"
  | "amount"
  | "archived_at"
  | "paid_at"
  | "due_at"
  | "paid_by"
  | "owner_id"
>;

function record(overrides: Partial<PartialRecord> = {}): PartialRecord {
  return {
    visibility: "HOUSEHOLD_SHARED",
    record_type: "EXPENSE",
    amount: 100_000,
    archived_at: null,
    paid_at: null,
    due_at: null,
    paid_by: null,
    owner_id: ALI.id,
    ...overrides,
  };
}

/** Balances are money; compare them in cents to stay clear of float noise. */
function cents(value: number) {
  return Math.round(value * 100);
}

function balanceOf(
  result: ReturnType<typeof settleHousehold>,
  memberId: string,
) {
  return result.balances.find((entry) => entry.memberId === memberId)?.balance;
}

describe("splitEvenly", () => {
  it("never loses or invents a cent", () => {
    for (const total of [0, 1, 99, 10_000_000, 100]) {
      for (const count of [1, 2, 3, 7]) {
        const shares = splitEvenly(total, count);
        expect(shares).toHaveLength(count);
        expect(shares.reduce((sum, value) => sum + value, 0)).toBe(total);
      }
    }
  });

  it("returns no shares for an empty household", () => {
    expect(splitEvenly(1000, 0)).toEqual([]);
  });
});

describe("isSettleableRecord", () => {
  it("accepts a shared expense", () => {
    expect(isSettleableRecord(record())).toBe(true);
  });

  it("rejects private records, income and archived records", () => {
    expect(isSettleableRecord(record({ visibility: "PRIVATE" }))).toBe(false);
    expect(isSettleableRecord(record({ record_type: "INCOME" }))).toBe(false);
    expect(
      isSettleableRecord(record({ archived_at: "2026-01-01T00:00:00.000Z" })),
    ).toBe(false);
  });

  it("rejects unpaid bills but accepts paid ones", () => {
    expect(isSettleableRecord(record({ record_type: "BILL" }))).toBe(false);
    expect(
      isSettleableRecord(
        record({ record_type: "BILL", paid_at: "2026-01-02T00:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("rejects an unpaid record that carries a due date", () => {
    expect(
      isSettleableRecord(record({ due_at: "2026-11-01T00:00:00.000Z" })),
    ).toBe(false);
    expect(
      isSettleableRecord(
        record({
          due_at: "2026-11-01T00:00:00.000Z",
          paid_at: "2026-10-20T00:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });

  it("rejects zero and negative amounts", () => {
    expect(isSettleableRecord(record({ amount: 0 }))).toBe(false);
    expect(isSettleableRecord(record({ amount: -25_000 }))).toBe(false);
  });
});

describe("settleHousehold", () => {
  it("splits a single shared expense between two members", () => {
    const result = settleHousehold({
      records: [record({ amount: 100_000, paid_by: ALI.id })],
      members: [ALI, SARA],
    });

    expect(cents(balanceOf(result, ALI.id) ?? 0)).toBe(5_000_000);
    expect(cents(balanceOf(result, SARA.id) ?? 0)).toBe(-5_000_000);
    expect(result.transfers).toEqual([
      {
        fromId: SARA.id,
        fromName: "سارا",
        toId: ALI.id,
        toName: "علی",
        amount: 50_000,
      },
    ]);
    expect(result.isSettled).toBe(false);
  });

  it("keeps balances summing to zero when the split is not exact", () => {
    const result = settleHousehold({
      records: [record({ amount: 100_000, paid_by: ALI.id })],
      members: [ALI, SARA, REZA],
    });

    const sum = result.balances.reduce(
      (total, entry) => total + cents(entry.balance),
      0,
    );

    expect(sum).toBe(0);
    expect(cents(result.total)).toBe(10_000_000);
    // Shares are 33_333.34 / 33_333.33 / 33_333.33 in toman.
    expect(result.balances.map((entry) => cents(entry.share))).toEqual([
      3_333_334, 3_333_333, 3_333_333,
    ]);
  });

  it("nets multiple payers against each other", () => {
    const result = settleHousehold({
      records: [
        record({ amount: 90_000, paid_by: ALI.id }),
        record({ amount: 30_000, paid_by: SARA.id }),
      ],
      members: [ALI, SARA],
    });

    expect(cents(balanceOf(result, ALI.id) ?? 0)).toBe(3_000_000);
    expect(cents(balanceOf(result, SARA.id) ?? 0)).toBe(-3_000_000);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      fromId: SARA.id,
      toId: ALI.id,
      amount: 30_000,
    });
  });

  it("uses the owner as payer when the record was never marked paid", () => {
    const result = settleHousehold({
      records: [record({ amount: 80_000, paid_by: null, owner_id: SARA.id })],
      members: [ALI, SARA],
    });

    expect(balanceOf(result, SARA.id)).toBeCloseTo(40_000, 2);
    expect(balanceOf(result, ALI.id)).toBeCloseTo(-40_000, 2);
  });

  it("ignores records that cannot create a debt", () => {
    const result = settleHousehold({
      records: [
        record({ visibility: "PRIVATE", paid_by: ALI.id }),
        record({ record_type: "INCOME", paid_by: ALI.id }),
        record({ record_type: "BILL", paid_by: ALI.id }),
        record({ archived_at: "2026-02-01T00:00:00.000Z", paid_by: ALI.id }),
      ],
      members: [ALI, SARA],
    });

    expect(result.total).toBe(0);
    expect(result.isSettled).toBe(true);
  });

  it("leaves out records paid by someone outside the household", () => {
    const result = settleHousehold({
      records: [record({ paid_by: "u-left" })],
      members: [ALI, SARA],
    });

    expect(result.total).toBe(0);
    expect(result.transfers).toEqual([]);
  });

  it("produces at most one transfer per member and settles a flat case", () => {
    const result = settleHousehold({
      records: [
        record({ amount: 300_000, paid_by: ALI.id }),
        record({ amount: 100_000, paid_by: SARA.id }),
      ],
      members: [ALI, SARA, REZA],
    });

    // Total 400_000 over three members → 133_333.33 each.
    expect(result.transfers.length).toBeLessThanOrEqual(2);
    expect(result.balances.reduce((sum, e) => sum + cents(e.balance), 0)).toBe(
      0,
    );
    expect(result.transfers.every((transfer) => transfer.amount > 0)).toBe(
      true,
    );
  });

  it("reports a settled household when everyone paid their share", () => {
    const result = settleHousehold({
      records: [
        record({ amount: 50_000, paid_by: ALI.id }),
        record({ amount: 50_000, paid_by: SARA.id }),
      ],
      members: [ALI, SARA],
    });

    expect(result.isSettled).toBe(true);
    expect(result.transfers).toEqual([]);
    expect(result.total).toBe(100_000);
  });

  it("treats a single-member household as settled", () => {
    const result = settleHousehold({
      records: [record({ amount: 70_000, paid_by: ALI.id })],
      members: [ALI],
    });

    expect(result.balances).toEqual([
      {
        memberId: ALI.id,
        name: "علی",
        paid: 70_000,
        share: 70_000,
        balance: 0,
      },
    ]);
    expect(result.isSettled).toBe(true);
  });

  it("handles an empty household and empty history", () => {
    expect(settleHousehold({ records: [record()], members: [] })).toEqual({
      balances: [],
      transfers: [],
      total: 0,
      isSettled: true,
    });

    expect(
      settleHousehold({ records: [], members: [ALI, SARA] }),
    ).toMatchObject({ total: 0, isSettled: true, transfers: [] });
  });

  it("de-duplicates members so nobody is counted twice", () => {
    const result = settleHousehold({
      records: [record({ amount: 40_000, paid_by: ALI.id })],
      members: [ALI, ALI, SARA],
    });

    expect(result.balances).toHaveLength(2);
    expect(balanceOf(result, SARA.id)).toBeCloseTo(-20_000, 2);
  });

  it("accepts numeric strings coming straight from Postgres", () => {
    const result = settleHousehold({
      records: [record({ amount: "125000.50", paid_by: ALI.id })],
      members: [ALI, SARA],
    });

    expect(cents(balanceOf(result, SARA.id) ?? 0)).toBe(-6_250_025);
    expect(cents(balanceOf(result, ALI.id) ?? 0)).toBe(6_250_025);
  });
});
