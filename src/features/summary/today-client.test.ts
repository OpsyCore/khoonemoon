import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToday } from "./today-client";

it("resolves reminder titles only from visible targets, otherwise uses a neutral label", async () => {
  const now = new Date(2026, 0, 10, 12);
  const stamp = now.toISOString();
  const data: Record<string, unknown[]> = {
    tasks: [
      { id: "visible", title: "کار مجاز", due_at: stamp, status: "PENDING" },
    ],
    events: [],
    chores: [],
    financial_records: [],
    reminders: ["visible", "inaccessible"].map((id) => ({
      id,
      target_id: id,
      target_type: "TASK",
      remind_at: stamp,
      status: "PENDING",
      snoozed_until: null,
      delivered_at: null,
    })),
  };
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      is: () => query,
      order: () => query,
      range: async () => ({ data: data[table], error: null }),
    };
    return query;
  });
  const result = await getToday({ from } as unknown as SupabaseClient, now);
  expect(result.reminders.map((r) => r.title)).toEqual(["کار مجاز", "یادآور"]);
  expect(from).toHaveBeenCalledTimes(5);
});
