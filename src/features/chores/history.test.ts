import { describe, expect, it } from "vitest";
import {
  buildChoreHistory,
  dayKey,
  groupChoreHistoryByDay,
  summarizeChoreHistory,
} from "@/features/chores/history";

const MEMBERS = [
  { user_id: "u-ali", full_name: "علی" },
  { user_id: "u-sara", full_name: "سارا" },
];

const CHORES = [
  { id: "c-dish", title: "شستن ظرف‌ها" },
  { id: "c-trash", title: "بردن زباله" },
];

function completion(
  overrides: Partial<{
    id: string;
    chore_id: string;
    completed_by: string;
    completed_at: string;
    note: string | null;
  }> = {},
) {
  return {
    id: "x-1",
    chore_id: "c-dish",
    completed_by: "u-ali",
    completed_at: "2026-10-20T10:00:00.000Z",
    note: null,
    ...overrides,
  };
}

const NOW = new Date("2026-10-29T12:00:00.000Z");

describe("buildChoreHistory", () => {
  it("resolves chore titles and member names", () => {
    const entries = buildChoreHistory({
      completions: [completion()],
      chores: CHORES,
      members: MEMBERS,
    });

    expect(entries).toEqual([
      {
        id: "x-1",
        choreId: "c-dish",
        choreTitle: "شستن ظرف‌ها",
        memberId: "u-ali",
        memberName: "علی",
        completedAt: "2026-10-20T10:00:00.000Z",
        note: null,
      },
    ]);
  });

  it("sorts newest first", () => {
    const entries = buildChoreHistory({
      completions: [
        completion({ id: "old", completed_at: "2026-10-01T10:00:00.000Z" }),
        completion({ id: "new", completed_at: "2026-10-25T10:00:00.000Z" }),
        completion({ id: "mid", completed_at: "2026-10-10T10:00:00.000Z" }),
      ],
      chores: CHORES,
      members: MEMBERS,
    });

    expect(entries.map((entry) => entry.id)).toEqual(["new", "mid", "old"]);
  });

  it("falls back to honest labels for deleted chores and departed members", () => {
    const entries = buildChoreHistory({
      completions: [completion({ chore_id: "c-gone", completed_by: "u-gone" })],
      chores: CHORES,
      members: MEMBERS,
    });

    expect(entries[0].choreTitle).toBe("کار حذف‌شده");
    expect(entries[0].memberName).toBe("عضو سابق خانه");
  });

  it("drops rows with an unusable timestamp", () => {
    const entries = buildChoreHistory({
      completions: [
        completion({ id: "bad", completed_at: "not-a-date" }),
        completion({ id: "good" }),
      ],
      chores: CHORES,
      members: MEMBERS,
    });

    expect(entries.map((entry) => entry.id)).toEqual(["good"]);
  });

  it("returns an empty list when there is no history", () => {
    expect(
      buildChoreHistory({ completions: [], chores: CHORES, members: MEMBERS }),
    ).toEqual([]);
  });
});

describe("summarizeChoreHistory", () => {
  it("counts each member inside the window and sorts by count", () => {
    const summary = summarizeChoreHistory({
      completions: [
        completion({ id: "1", completed_by: "u-ali" }),
        completion({ id: "2", completed_by: "u-ali" }),
        completion({ id: "3", completed_by: "u-sara" }),
      ],
      chores: CHORES,
      members: MEMBERS,
      now: NOW,
    });

    expect(summary.total).toBe(3);
    expect(summary.shares).toEqual([
      { memberId: "u-ali", memberName: "علی", count: 2 },
      { memberId: "u-sara", memberName: "سارا", count: 1 },
    ]);
    expect(summary.busiestCount).toBe(2);
  });

  it("excludes completions older than the window", () => {
    const summary = summarizeChoreHistory({
      completions: [
        completion({ id: "recent", completed_at: "2026-10-28T10:00:00.000Z" }),
        completion({ id: "ancient", completed_at: "2026-08-01T10:00:00.000Z" }),
      ],
      chores: CHORES,
      members: MEMBERS,
      now: NOW,
    });

    expect(summary.total).toBe(1);
    expect(summary.entries[0].id).toBe("recent");
  });

  it("ignores timestamps in the future (clock skew)", () => {
    const summary = summarizeChoreHistory({
      completions: [
        completion({ id: "future", completed_at: "2026-12-01T10:00:00.000Z" }),
      ],
      chores: CHORES,
      members: MEMBERS,
      now: NOW,
    });

    expect(summary.total).toBe(0);
    expect(summary.busiestCount).toBe(0);
  });

  it("honours a custom window", () => {
    const completions = [
      completion({ id: "today", completed_at: "2026-10-29T08:00:00.000Z" }),
      completion({ id: "last-week", completed_at: "2026-10-20T08:00:00.000Z" }),
    ];

    expect(
      summarizeChoreHistory({
        completions,
        chores: CHORES,
        members: MEMBERS,
        now: NOW,
        windowDays: 7,
      }).total,
    ).toBe(1);

    expect(
      summarizeChoreHistory({
        completions,
        chores: CHORES,
        members: MEMBERS,
        now: NOW,
        windowDays: 30,
      }).total,
    ).toBe(2);
  });

  it("is empty and safe for a household with no history", () => {
    const summary = summarizeChoreHistory({
      completions: [],
      chores: [],
      members: [],
      now: NOW,
    });

    expect(summary).toEqual({
      total: 0,
      entries: [],
      shares: [],
      busiestCount: 0,
    });
  });
});

describe("dayKey / groupChoreHistoryByDay", () => {
  it("returns null for an invalid date", () => {
    expect(dayKey("nope")).toBeNull();
    expect(dayKey(new Date("2026-10-20T10:00:00.000Z"))).toBeTruthy();
  });

  it("groups consecutive entries of the same day together", () => {
    const entries = buildChoreHistory({
      completions: [
        completion({ id: "a", completed_at: "2026-10-28T18:00:00.000Z" }),
        completion({ id: "b", completed_at: "2026-10-28T09:00:00.000Z" }),
        completion({ id: "c", completed_at: "2026-10-27T09:00:00.000Z" }),
      ],
      chores: CHORES,
      members: MEMBERS,
    });

    const groups = groupChoreHistoryByDay(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(["c"]);
    expect(groups[0].label).toBe(groups[0].key);
  });

  it("handles an empty list", () => {
    expect(groupChoreHistoryByDay([])).toEqual([]);
  });
});
