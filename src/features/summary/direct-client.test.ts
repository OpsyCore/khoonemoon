import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMobileWeeklySummary } from "./direct-client";
function setup(fail?: string) {
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
  it("does not display a partial recap on query failure", async () => {
    const { client } = setup("tasks");
    await expect(getMobileWeeklySummary(client, new Date())).rejects.toThrow();
  });
});
