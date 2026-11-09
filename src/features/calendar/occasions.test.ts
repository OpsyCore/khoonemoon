import { describe, expect, it } from "vitest";
import { getJalaliParts, resolveJalaliDate } from "@/shared/utils/jalali";
import { nextOccasionBaseAt, projectCalendarEvents } from "./occasions";
import type { EventRecord } from "./types";

describe("Jalali annual occasions", () => {
  it("resolves 30 Esfand accurately in leap year 1403 and adjusts to 29 Esfand in non-leap year 1404", () => {
    const leap1403 = resolveJalaliDate(1403, 12, 30);
    expect(leap1403.leapAdjusted).toBe(false);
    expect(getJalaliParts(leap1403.date)).toEqual({
      year: 1403,
      month: 12,
      day: 30,
    });

    const nonLeap1404 = resolveJalaliDate(1404, 12, 30);
    expect(nonLeap1404.leapAdjusted).toBe(true);
    expect(getJalaliParts(nonLeap1404.date)).toEqual({
      year: 1404,
      month: 12,
      day: 29,
    });
  });

  it("projects annual occasions across future Jalali years with elapsed year counts", () => {
    const base = resolveJalaliDate(1400, 7, 15).date;
    const occasion: EventRecord = {
      id: "occ-1",
      title: "سالگرد عقد",
      description: null,
      creator_id: "u1",
      owner_id: "u1",
      household_id: "h1",
      visibility: "HOUSEHOLD_SHARED",
      start_at: new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        0,
        0,
      ).toISOString(),
      end_at: new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + 1,
        0,
        0,
      ).toISOString(),
      all_day: true,
      location: null,
      occasion_type: "ANNIVERSARY",
      recurrence_calendar: "JALALI_YEARLY",
      jalali_month: 7,
      jalali_day: 15,
      gift_idea: "سفر کوتاه",
      occasion_plan: "شام دونفره",
      created_at: base.toISOString(),
      updated_at: base.toISOString(),
    };

    const target1405 = resolveJalaliDate(1405, 7, 15).date;
    const from = new Date(target1405);
    from.setDate(from.getDate() - 3);
    const to = new Date(target1405);
    to.setDate(to.getDate() + 3);

    const projected = projectCalendarEvents([occasion], from, to);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.occurrenceYear).toBe(1405);
    expect(projected[0]?.yearsElapsed).toBe(5);
    expect(projected[0]?.gift_idea).toBe("سفر کوتاه");
  });

  it("computes the next upcoming occasion reminder base in the future", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const next = nextOccasionBaseAt(1, 1, 9, 0, now);
    expect(new Date(next.iso).getTime()).toBeGreaterThan(now.getTime());
  });
});
