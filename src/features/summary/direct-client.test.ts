import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMobileWeeklySummary } from "./direct-client";
function setup(fail?: string, finance?: unknown[]) {
  const data: Record<string, unknown[]> = {
    tasks: [{ id: "a", completed_at: "2026-01-09T00:00:00Z" }],
    chore_completions: [{ id: "c", completed_at: "2026-01-02T00:00:00Z" }],
    financial_records: [
      {
        id: "f",
        record_type: "EXPENSE",
        amount: 100,
        currency: "IRR",
        occurred_at: "2026-01-09T00:00:00Z",
        paid_at: null,
      },
      {
        id: "g",
        record_type: "EXPENSE",
        amount: 5,
        currency: "USD",
        occurred_at: "2026-01-09T00:00:00Z",
        paid_at: null,
      },
    ],
  };
  if (finance) data.financial_records = finance;
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      gte: () => query,
      lt: () => query,
      is: () => query,
      order: () => query,
      range: async () => ({
        data: data[table] ?? [],
        error: table === fail ? {} : null,
      }),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient };
}
describe("mobile weekly recap", () => {
  it("separates currencies and counts only authorized data supplied by RLS", async () => {
    const { client } = setup();
    const result = await getMobileWeeklySummary(
      client,
      new Date("2026-01-10T00:00:00Z"),
    );
    expect(result.counts.tasksDone).toBe(1);
    expect(result.counts.choresDonePrevious).toBe(1);
    expect(result.currencies.map((x) => [x.currency, x.summary.spent])).toEqual(
      [
        ["IRR", 100],
        ["USD", 5],
      ],
    );
  });
  it("counts shared spending separately by currency and excludes unpaid and private records", async () => {
    const record = (id: string, changes: Record<string, unknown>) => ({
      id,
      record_type: "EXPENSE",
      amount: 10,
      currency: "IRR",
      occurred_at: "2026-01-09T00:00:00Z",
      paid_at: null,
      due_at: null,
      visibility: "HOUSEHOLD_SHARED",
      ...changes,
    });
    const { client } = setup(undefined, [
      record("expense", {}),
      record("private", { visibility: "PRIVATE", amount: 100 }),
      record("unpaid", {
        record_type: "BILL",
        due_at: "2026-01-09T00:00:00Z",
        amount: 500,
      }),
      record("paid", {
        record_type: "BILL",
        due_at: "2026-01-08T00:00:00Z",
        paid_at: "2026-01-09T00:00:00Z",
        amount: 20,
      }),
      record("debt", { record_type: "DEBT", amount: 1000 }),
      record("dollars", { currency: "USD", amount: 3 }),
    ]);
    const result = await getMobileWeeklySummary(
      client,
      new Date("2026-01-10T00:00:00Z"),
    );
    expect(
      result.sharedCurrencies.map(({ currency, summary }) => [
        currency,
        summary.spent,
      ]),
    ).toEqual([
      ["IRR", 30],
      ["USD", 3],
    ]);
  });
  it("does not display a partial recap on query failure", async () => {
    const { client } = setup("tasks");
    await expect(getMobileWeeklySummary(client, new Date())).rejects.toThrow();
  });
});
