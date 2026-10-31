import { describe, expect, it } from "vitest";
import { reminderPreferencesSchema } from "./schemas";
const base = {
  inAppEnabled: true,
  webPushEnabled: false,
  quietHoursEnabled: true,
};
describe("reminder quiet hours validation", () => {
  it("accepts valid overnight ranges", () => {
    expect(
      reminderPreferencesSchema.safeParse({
        ...base,
        quietHoursStart: "22:30",
        quietHoursEnd: "07:15",
      }).success,
    ).toBe(true);
  });
  it("rejects invalid hours and minutes", () => {
    for (const time of ["24:00", "23:60", "99:99", "1:00"])
      expect(
        reminderPreferencesSchema.safeParse({
          ...base,
          quietHoursStart: time,
          quietHoursEnd: "08:00",
        }).success,
      ).toBe(false);
  });
  it("requires both values for an enabled quiet period", () => {
    expect(
      reminderPreferencesSchema.safeParse({
        ...base,
        quietHoursStart: null,
        quietHoursEnd: "08:00",
      }).success,
    ).toBe(false);
  });
});
