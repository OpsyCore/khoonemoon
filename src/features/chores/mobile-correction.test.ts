import { describe, it, expect } from "vitest";
import { choreChanges, chorePatch } from "../../../mobile/src/chore-correction";
import type { ChoreRecord } from "./types";
const member = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const original = {
  title: "ظرف",
  description: null,
  next_due_at: "2026-10-01T09:00:30.123+00:00",
  rotation_mode: "ROTATING",
  frequency: "DAILY",
  interval_days: null,
  weekdays: null,
  chore_rotation_steps: [
    { position: 0, assignee_id: member },
    { position: 1, assignee_id: other },
  ],
} as ChoreRecord;
const form = {
  title: "ظرف",
  description: "",
  nextDueAt: "2026-10-01T09:00:30.123Z",
  rotationMode: "ROTATING",
  frequency: "DAILY",
  assigneeIds: [member, other],
  intervalDays: null,
  weekdays: null,
} as const;
describe("chore correction preview", () => {
  it("compares all fields without losing timestamp precision or member ordering", () => {
    expect(
      choreChanges(original, { ...form, assigneeIds: [member, other] }),
    ).toEqual([]);
    expect(
      choreChanges(original, {
        ...form,
        title: "آشپزی",
        assigneeIds: [other, member],
      }),
    ).toEqual(["عنوان", "ترتیب اعضا"]);
  });
  it("validates the new rotation rather than previewing invalid input", () => {
    expect(() =>
      choreChanges(original, { ...form, assigneeIds: [member] }),
    ).toThrow();
  });
  it("sends only changed fields, preserving the due timezone and ordered members", () => {
    expect(
      chorePatch(original, { ...form, assigneeIds: [member, other] }, "UTC"),
    ).toEqual({});
    expect(
      chorePatch(
        original,
        { ...form, title: "آشپزی", assigneeIds: [member, other] },
        "UTC",
      ),
    ).toEqual({ title: "آشپزی" });
    expect(
      chorePatch(
        original,
        { ...form, nextDueAt: null, assigneeIds: [member, other] },
        "Asia/Tehran",
      ),
    ).toEqual({ nextDueAt: null, recurrenceTimezone: "Asia/Tehran" });
  });
});
