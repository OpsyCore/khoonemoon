import { describe, expect, it } from "vitest";
import { deriveToday } from "./today-mobile";
describe("today dashboard", () => {
  it("counts today and overdue actionable items without completed or future records", () => {
    const now = new Date(2026, 0, 10, 12);
    const stamp = (day: number, hour = 12) =>
      new Date(2026, 0, day, hour).toISOString();
    const output = deriveToday({
      now,
      tasks: [
        { id: "a", title: "late", status: "PENDING", due_at: stamp(9) },
        { id: "b", title: "done", status: "COMPLETED", due_at: stamp(10) },
        { id: "c", title: "future", status: "PENDING", due_at: stamp(11) },
      ],
      events: [
        { id: "e", title: "event", start_at: stamp(10) },
        { id: "f", title: "tomorrow", start_at: stamp(11) },
      ],
      chores: [
        { id: "c", title: "chore", is_active: true, next_due_at: stamp(9) },
        { id: "d", title: "paused", is_active: false, next_due_at: stamp(10) },
      ],
      bills: [
        {
          id: "b",
          title: "bill",
          record_type: "BILL",
          due_at: stamp(10),
          paid_at: null,
        },
        {
          id: "p",
          title: "paid",
          record_type: "BILL",
          due_at: stamp(10),
          paid_at: stamp(9),
        },
      ],
      reminders: [
        {
          id: "r",
          remind_at: stamp(9),
          status: "SNOOZED",
          snoozed_until: stamp(11),
          delivered_at: null,
        },
        {
          id: "t",
          remind_at: stamp(10),
          status: "PENDING",
          snoozed_until: null,
          delivered_at: null,
        },
      ],
    });
    expect(output.tasks.map((x) => x.id)).toEqual(["a"]);
    expect(output.events.map((x) => x.id)).toEqual(["e"]);
    expect(output.chores.map((x) => x.id)).toEqual(["c"]);
    expect(output.bills.map((x) => x.id)).toEqual(["b"]);
    expect(output.reminders.map((x) => x.id)).toEqual(["t"]);
  });
});
