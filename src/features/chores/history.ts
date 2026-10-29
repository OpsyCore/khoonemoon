import type { ChoreCompletion } from "@/features/chores/types";

/**
 * Chore history ("تاریخچه کارهای خانه").
 *
 * `chore_completions` has been written by `complete_chore()` since M7 but was
 * never rendered anywhere. This module turns the raw rows into something a
 * household can actually read: who did what and when, plus a fair-share summary
 * that makes unbalanced workloads obvious.
 */

export type ChoreHistoryEntry = {
  id: string;
  choreId: string;
  /** Chore title, or a fallback when the chore was deleted/archived. */
  choreTitle: string;
  memberId: string;
  /** Member name, or a fallback for people who left the household. */
  memberName: string;
  completedAt: string;
  note: string | null;
};

export type ChoreMemberShare = {
  memberId: string;
  memberName: string;
  count: number;
};

export type ChoreHistorySummary = {
  total: number;
  /** Completions inside the window, newest first. */
  entries: ChoreHistoryEntry[];
  /** Per-member counts over the whole window, biggest contributor first. */
  shares: ChoreMemberShare[];
  /** Highest count in the window; 0 when the window is empty. */
  busiestCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildChoreHistory({
  completions,
  chores,
  members,
}: {
  completions: Pick<
    ChoreCompletion,
    "id" | "chore_id" | "completed_by" | "completed_at" | "note"
  >[];
  chores: { id: string; title: string }[];
  members: { user_id: string; full_name: string }[];
}): ChoreHistoryEntry[] {
  const choreTitles = new Map(chores.map((chore) => [chore.id, chore.title]));
  const memberNames = new Map(
    members.map((member) => [member.user_id, member.full_name]),
  );

  return completions
    .filter((completion) => {
      // A row without a usable timestamp cannot be placed on a timeline.
      const time = new Date(completion.completed_at).getTime();
      return Number.isFinite(time);
    })
    .map((completion) => ({
      id: completion.id,
      choreId: completion.chore_id,
      choreTitle: choreTitles.get(completion.chore_id) ?? "کار حذف‌شده",
      memberId: completion.completed_by,
      memberName: memberNames.get(completion.completed_by) ?? "عضو سابق خانه",
      completedAt: completion.completed_at,
      note: completion.note ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
}

export function summarizeChoreHistory({
  completions,
  chores,
  members,
  now,
  windowDays = 30,
}: {
  completions: Pick<
    ChoreCompletion,
    "id" | "chore_id" | "completed_by" | "completed_at" | "note"
  >[];
  chores: { id: string; title: string }[];
  members: { user_id: string; full_name: string }[];
  now: Date;
  windowDays?: number;
}): ChoreHistorySummary {
  const cutoff = now.getTime() - windowDays * DAY_MS;

  const all = buildChoreHistory({ completions, chores, members });

  // Future timestamps are kept out of the window: a clock skew on one device
  // should not make the summary look busier than reality.
  const entries = all.filter((entry) => {
    const time = new Date(entry.completedAt).getTime();
    return time <= now.getTime() && time >= cutoff;
  });

  const counts = new Map<string, ChoreMemberShare>();

  for (const entry of entries) {
    const current = counts.get(entry.memberId);

    if (current) {
      current.count += 1;
    } else {
      counts.set(entry.memberId, {
        memberId: entry.memberId,
        memberName: entry.memberName,
        count: 1,
      });
    }
  }

  const shares = [...counts.values()].sort(
    (a, b) =>
      b.count - a.count || a.memberName.localeCompare(b.memberName, "fa"),
  );

  return {
    total: entries.length,
    entries,
    shares,
    busiestCount: shares[0]?.count ?? 0,
  };
}

/** `۱۴۰۵/۰۸/۰۶` — a stable, locale-aware day label for grouping. */
export function dayKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Groups entries by day, preserving the newest-first order. */
export function groupChoreHistoryByDay(
  entries: ChoreHistoryEntry[],
): { key: string; label: string; entries: ChoreHistoryEntry[] }[] {
  const groups: { key: string; label: string; entries: ChoreHistoryEntry[] }[] =
    [];

  for (const entry of entries) {
    const key = dayKey(entry.completedAt);
    if (!key) continue;

    const last = groups[groups.length - 1];

    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: key, entries: [entry] });
    }
  }

  return groups;
}
