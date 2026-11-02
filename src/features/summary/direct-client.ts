import type { SupabaseClient } from "@supabase/supabase-js";
import { directFinance } from "@/features/finance/direct-client";
import { buildWeeklySummary, type WeeklySummary } from "./weekly-summary";

async function completions(
  client: SupabaseClient,
  table: "tasks" | "chore_completions",
  start: string,
  end: string,
) {
  const rows: { completed_at: string | null }[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await client
      .from(table)
      .select("id,completed_at")
      .gte("completed_at", start)
      .lt("completed_at", end)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("دریافت خلاصه هفتگی ناموفق بود.");
    rows.push(...((data ?? []) as { completed_at: string | null }[]));
    if (!data || data.length < 500) return rows;
  }
  throw new Error("اطلاعات خلاصه بیش از حد مجاز است.");
}
export type MobileWeeklySummary = {
  counts: WeeklySummary;
  currencies: { currency: string; summary: WeeklySummary }[];
  sharedCurrencies: { currency: string; summary: WeeklySummary }[];
};
export async function getMobileWeeklySummary(
  client: SupabaseClient,
  now: Date,
): Promise<MobileWeeklySummary> {
  const end = now.toISOString(),
    start = new Date(now.getTime() - 14 * 86400000).toISOString();
  const [tasks, chores, finance] = await Promise.all([
    completions(client, "tasks", start, end),
    completions(client, "chore_completions", start, end),
    directFinance(client).list(),
  ]);
  const groups = [...new Set(finance.map((record) => record.currency))].sort();
  return {
    counts: buildWeeklySummary({
      tasks,
      chores: chores.filter(
        (r): r is { completed_at: string } => !!r.completed_at,
      ),
      finance: [],
      now,
    }),
    sharedCurrencies: groups.map((currency) => ({
      currency,
      summary: buildWeeklySummary({
        tasks: [],
        chores: [],
        finance: finance.filter(
          (r) =>
            r.currency === currency &&
            r.visibility === "HOUSEHOLD_SHARED" &&
            r.record_type !== "INCOME" &&
            r.record_type !== "DEBT" &&
            (!(
              r.due_at ||
              ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(r.record_type)
            ) ||
              !!r.paid_at),
        ),
        now,
      }),
    })),
    currencies: groups.map((currency) => ({
      currency,
      summary: buildWeeklySummary({
        tasks: [],
        chores: [],
        finance: finance.filter((r) => r.currency === currency),
        now,
      }),
    })),
  };
}
