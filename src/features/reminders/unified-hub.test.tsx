// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReminderInbox, classifyReminderHorizon } from "./inbox";
import { filterReminderInbox } from "./reference-filter";
import type { ReminderRecord } from "./types";
import { Reminders } from "../../../mobile/src/reminders";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  preferences: vi.fn(),
  tasks: vi.fn(),
  events: vi.fn(),
  chores: vi.fn(),
  bills: vi.fn(),
  docs: vi.fn(),
  appliances: vi.fn(),
  meals: vi.fn(),
  members: vi.fn(),
}));

vi.mock("@/features/reminders/direct-client", () => ({
  directReminders: () => ({
    list: mocks.list,
    preferences: mocks.preferences,
  }),
}));
vi.mock("@/features/tasks/direct-client", () => ({
  directTasks: () => ({ list: mocks.tasks }),
}));
vi.mock("@/features/calendar/direct-client", () => ({
  directCalendar: () => ({ list: mocks.events }),
}));
vi.mock("@/features/chores/direct-client", () => ({
  directChores: () => ({ list: mocks.chores }),
}));
vi.mock("@/features/finance/direct-client", () => ({
  directFinance: () => ({ list: mocks.bills }),
}));
vi.mock("@/features/documents/direct-client", () => ({
  directDocuments: () => ({ list: mocks.docs }),
}));
vi.mock("@/features/appliances/direct-client", () => ({
  directAppliances: () => ({ list: mocks.appliances }),
}));
vi.mock("@/features/meals/direct-client", () => ({
  directMeals: () => ({ listWeek: mocks.meals }),
}));
vi.mock("@/features/households/members", () => ({
  loadHouseholdMembers: mocks.members,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("unified reminder hub", () => {
  it("classifies overdue, today, tomorrow and next-week horizons and filters by source group", () => {
    const now = new Date(2026, 9, 28, 10, 0, 0);
    const mk = (
      id: string,
      type: ReminderRecord["target_type"],
      targetId: string,
      at: Date,
    ): ReminderRecord => ({
      id,
      target_type: type,
      target_id: targetId,
      user_id: "u1",
      household_id: "h1",
      remind_at: at.toISOString(),
      status: "PENDING",
      snoozed_until: null,
      snooze_count: 0,
      delivered_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const tomorrow = new Date(2026, 9, 29, 9, 0, 0);
    const nextWeek = new Date(2026, 10, 2, 9, 0, 0);

    expect(
      classifyReminderHorizon({
        reminder: { status: "PENDING", remind_at: tomorrow.toISOString() },
        now,
      }),
    ).toBe("TOMORROW");
    expect(
      classifyReminderHorizon({
        reminder: { status: "PENDING", remind_at: nextWeek.toISOString() },
        now,
      }),
    ).toBe("NEXT_7_DAYS");

    const inbox = buildReminderInbox({
      reminders: [
        mk("r1", "DOCUMENT", "d1", tomorrow),
        mk("r2", "APPLIANCE", "a1", nextWeek),
      ],
      tasks: [],
      events: [],
      documents: [{ id: "d1", title: "بیمه ثالث", group: "DOCUMENT" }],
      appliances: [
        {
          id: "a1",
          title: "پکیج",
          group: "APPLIANCE",
          assigneeLabel: "علی",
          recurrenceLabel: "هر ۱۸۰ روز",
        },
      ],
      now,
    });

    expect(filterReminderInbox(inbox, "TOMORROW", now)).toHaveLength(1);
    expect(
      filterReminderInbox(inbox, "NEXT_7_DAYS", now, "APPLIANCE")[0]
        ?.assigneeLabel,
    ).toBe("علی");
  });

  it("deep-links to the source module from the unified reminder card", async () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    mocks.list.mockResolvedValue([
      {
        id: "rem-doc-1",
        target_type: "DOCUMENT",
        target_id: "doc-1",
        user_id: "u1",
        household_id: null,
        remind_at: future,
        status: "PENDING",
        snoozed_until: null,
        snooze_count: 0,
        delivered_at: null,
        created_at: future,
        updated_at: future,
      },
    ]);
    mocks.preferences.mockResolvedValue(null);
    mocks.tasks.mockResolvedValue([]);
    mocks.events.mockResolvedValue([]);
    mocks.chores.mockResolvedValue([]);
    mocks.bills.mockResolvedValue([]);
    mocks.docs.mockResolvedValue([
      { id: "doc-1", title: "بیمه‌نامه بدنه", expires_at: "2027-01-01" },
    ]);
    mocks.appliances.mockResolvedValue([]);
    mocks.meals.mockResolvedValue([]);
    mocks.members.mockResolvedValue([]);

    const onNavigate = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const fakeClient = {
      from: (table: string) => ({
        select: () => ({
          limit: async () => ({
            data:
              table === "documents"
                ? [
                    {
                      id: "doc-1",
                      title: "بیمه‌نامه بدنه",
                      expires_at: "2027-01-01",
                    },
                  ]
                : [],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    await act(async () => {
      root.render(
        <Reminders
          client={fakeClient}
          householdId={null}
          notificationStatus=""
          onNavigate={onNavigate}
        />,
      );
    });

    expect(host.textContent).toContain("بیمه‌نامه بدنه");
    const openBtn = [
      ...host.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.includes("مشاهده منبع"))!;
    await act(async () => openBtn.click());
    expect(onNavigate).toHaveBeenCalledWith("documents");
    await act(async () => root.unmount());
  });
});
