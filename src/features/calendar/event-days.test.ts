import { describe, it, expect } from "vitest";
import { eventDays, eventOverlaps } from "./event-days";
describe("calendar event day overlaps", () => {
  const day = (d: number, h = 0) => new Date(2026, 0, d, h);
  it("shows an event already in progress today", () => {
    expect(
      eventOverlaps(
        day(9, 12).toISOString(),
        day(11, 12).toISOString(),
        day(10),
        day(11),
      ),
    ).toBe(true);
    expect(
      eventOverlaps(
        day(9, 12).toISOString(),
        day(10).toISOString(),
        day(10),
        day(11),
      ),
    ).toBe(false);
  });
  it("marks each covered local day without adding the exclusive midnight end", () => {
    const dates = eventDays(
      day(9, 12).toISOString(),
      day(12).toISOString(),
      day(10),
      day(15),
    );
    expect(dates.map((d) => d.getDate())).toEqual([10, 11]);
  });
  it("rejects invalid or reversed event ranges", () => {
    expect(
      eventDays("invalid", day(11).toISOString(), day(10), day(12)),
    ).toEqual([]);
    expect(
      eventDays(day(11).toISOString(), day(10).toISOString(), day(10), day(12)),
    ).toEqual([]);
  });
});
