import { describe, expect, it } from "vitest";
import { taskEditTime } from "../../../mobile/src/task-edit-time";
import { toDateTimeLocal } from "@/features/quick-add/payload";

describe("standalone task edit time", () => {
  it("preserves the original instant, seconds and zone when the field is unchanged", () => {
    const instant = "2025-11-02T06:30:42.000Z";
    expect(
      taskEditTime(
        toDateTimeLocal(new Date(instant)),
        instant,
        "America/New_York",
        "Europe/Istanbul",
      ),
    ).toEqual({ dueAt: instant, recurrenceTimezone: "America/New_York" });
  });
  it("preserves PostgreSQL microseconds while normalizing the UTC offset", () => {
    const instant = "2026-05-01T06:30:42.123456+00:00";
    expect(
      taskEditTime(toDateTimeLocal(new Date(instant)), instant, "UTC", "UTC")
        .dueAt,
    ).toBe("2026-05-01T06:30:42.123456Z");
  });
  it("uses the current device zone when the user changes the due field", () => {
    const local = "2026-01-04T09:15";
    expect(taskEditTime(local, null, "Asia/Tehran", "Europe/Istanbul")).toEqual(
      {
        dueAt: new Date(local).toISOString(),
        recurrenceTimezone: "Europe/Istanbul",
      },
    );
  });
  it("preserves the zone for a recurring task with no due date", () => {
    expect(taskEditTime("", null, "Asia/Tehran", "UTC")).toEqual({
      dueAt: null,
      recurrenceTimezone: "Asia/Tehran",
    });
  });
});
