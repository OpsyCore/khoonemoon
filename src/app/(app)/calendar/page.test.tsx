import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "./page";

const mocks = vi.hoisted(() => ({
  tasks: vi.fn(),
  events: vi.fn(),
  bills: vi.fn(),
  chores: vi.fn(),
  membership: vi.fn(),
  user: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      maybeSingle: mocks.membership,
    };
    return { auth: { getUser: mocks.user }, from: () => query };
  },
}));
vi.mock("@/features/tasks/direct-client", () => ({
  directTasks: () => ({ list: mocks.tasks }),
}));
vi.mock("@/features/calendar/direct-client", () => ({
  directCalendar: () => ({ list: mocks.events }),
}));
vi.mock("@/features/finance/direct-client", () => ({
  directFinance: () => ({ list: mocks.bills }),
}));
vi.mock("@/features/chores/direct-client", () => ({
  directChores: () => ({ list: mocks.chores }),
}));
vi.mock("@/features/calendar/components/calendar-board", () => ({
  CalendarBoard: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "member" } } });
  mocks.membership.mockResolvedValue({
    data: { household_id: "house" },
    error: null,
  });
  mocks.tasks.mockResolvedValue([]);
  mocks.events.mockResolvedValue([]);
  mocks.bills.mockResolvedValue([]);
  mocks.chores.mockResolvedValue([]);
});

describe("web calendar data loading", () => {
  it("uses paginated clients and filters inactive or unscheduled chores", async () => {
    const manyTasks = Array.from({ length: 1001 }, (_, id) => ({
      id: String(id),
    }));
    mocks.tasks.mockResolvedValue(manyTasks);
    mocks.chores.mockResolvedValue([
      {
        id: "active",
        title: "کار",
        is_active: true,
        next_due_at: "2026-01-01T12:00:00Z",
        frequency: "NONE",
        interval_days: null,
        weekdays: null,
        recurrence_timezone: "UTC",
        completion_revision: 4,
      },
      { id: "inactive", is_active: false, next_due_at: "2026-01-01T12:00:00Z" },
      { id: "undated", is_active: true, next_due_at: null },
    ]);
    const result = await CalendarPage();
    const board = result.props.children;
    expect(board.props.tasks).toHaveLength(1001);
    expect(board.props.chores.map((item: { id: string }) => item.id)).toEqual([
      "active",
    ]);
    expect(board.props.chores[0].completion_revision).toBe(4);
    expect(mocks.chores).toHaveBeenCalledWith("house");
  });
  it("surfaces partial failures without inventing missing information", async () => {
    mocks.bills.mockRejectedValue(new Error("offline"));
    mocks.chores.mockRejectedValue(new Error("offline"));
    const result = await CalendarPage();
    expect(result.props.children.props.billsLoadError).toBe(true);
    expect(result.props.children.props.choresLoadError).toBe(true);
    expect(result.props.children.props.bills).toEqual([]);
  });
  it("does not display a partial list when events or tasks fail", async () => {
    mocks.events.mockRejectedValue(new Error("offline"));
    const result = await CalendarPage();
    expect(result.props.title).toBe("خطا در بارگذاری تقویم");
  });
});
