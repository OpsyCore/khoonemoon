import { describe, expect, it } from "vitest";
import { createEventSchema } from "@/features/calendar/schemas";

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: "شام خانوادگی",
    visibility: "PRIVATE",
    startAt: "2026-08-28T18:00:00.000Z",
    endAt: "2026-08-28T20:00:00.000Z",
    allDay: false,
    ...overrides,
  };
}

describe("event schemas", () => {
  it("accepts a valid event", () => {
    expect(createEventSchema.safeParse(validEvent()).success).toBe(true);
  });

  it("rejects an end time that is not after start", () => {
    expect(
      createEventSchema.safeParse(
        validEvent({
          startAt: "2026-08-28T20:00:00.000Z",
          endAt: "2026-08-28T18:00:00.000Z",
        }),
      ).success,
    ).toBe(false);

    expect(
      createEventSchema.safeParse(
        validEvent({
          startAt: "2026-08-28T18:00:00.000Z",
          endAt: "2026-08-28T18:00:00.000Z",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a short title", () => {
    expect(
      createEventSchema.safeParse(validEvent({ title: "ا" })).success,
    ).toBe(false);
  });

  it("rejects an unknown visibility", () => {
    expect(
      createEventSchema.safeParse(validEvent({ visibility: "ASSIGNED" }))
        .success,
    ).toBe(false);
  });
});
