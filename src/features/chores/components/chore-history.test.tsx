import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoreHistory } from "@/features/chores/components/chore-history";
import type { ChoreCompletion, ChoreRecord } from "@/features/chores/types";

const MEMBERS = [
  { user_id: "u-ali", full_name: "علی" },
  { user_id: "u-sara", full_name: "سارا" },
];

const CHORES = [
  {
    id: "c-dish",
    household_id: "h-1",
    title: "شستن ظرف‌ها",
    description: null,
    created_by: "u-ali",
    rotation_mode: "ROTATING",
    current_rotation_index: 0,
    frequency: "DAILY",
    interval_days: null,
    weekdays: null,
    next_due_at: null,
    is_active: true,
    archived_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    chore_rotation_steps: null,
  },
] as ChoreRecord[];

function completion(overrides: Partial<ChoreCompletion> = {}): ChoreCompletion {
  return {
    id: "comp-1",
    chore_id: "c-dish",
    completed_by: "u-ali",
    // Relative to "now" so the 30-day window never makes this test time-bomb.
    completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    due_at: null,
    note: null,
    ...overrides,
  };
}

describe("<ChoreHistory />", () => {
  it("renders the empty state when there is no history", () => {
    const html = renderToStaticMarkup(
      <ChoreHistory completions={[]} chores={CHORES} members={MEMBERS} />,
    );

    expect(html).toContain("تاریخچه کارهای خانه");
    expect(html).toContain("هنوز کاری در ۳۰ روز گذشته انجام نشده است");
  });

  it("renders per-member shares and the completion rows", () => {
    const html = renderToStaticMarkup(
      <ChoreHistory
        completions={[
          completion({ id: "comp-1", completed_by: "u-ali" }),
          completion({ id: "comp-2", completed_by: "u-sara" }),
        ]}
        chores={CHORES}
        members={MEMBERS}
      />,
    );

    expect(html).toContain("علی");
    expect(html).toContain("سارا");
    expect(html).toContain("شستن ظرف‌ها");
    expect(html).toContain("مورد در ۳۰ روز");
  });

  it("labels a chore that no longer exists instead of crashing", () => {
    const html = renderToStaticMarkup(
      <ChoreHistory
        completions={[completion({ chore_id: "c-deleted" })]}
        chores={CHORES}
        members={MEMBERS}
      />,
    );

    expect(html).toContain("کار حذف‌شده");
  });
});
