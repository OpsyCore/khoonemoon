import { describe, expect, it } from "vitest";
import {
  buildChorePatch,
  toChoreForm,
  type ChoreForm,
} from "@/features/chores/corrections";
import type { ChoreRecord } from "@/features/chores/types";

const CHORE = {
  title: "شستن ظرف‌ها",
  frequency: "WEEKLY",
  rotation_mode: "FIXED",
} as Pick<ChoreRecord, "title" | "frequency" | "rotation_mode">;

function form(overrides: Partial<ChoreForm> = {}): ChoreForm {
  return { ...toChoreForm(CHORE), ...overrides };
}

describe("toChoreForm", () => {
  it("fills the form from the chore", () => {
    expect(toChoreForm(CHORE)).toEqual({
      title: "شستن ظرف‌ها",
      frequency: "WEEKLY",
      rotationMode: "FIXED",
    });
  });
});

describe("buildChorePatch", () => {
  it("reports no change for an untouched form", () => {
    expect(
      buildChorePatch({ chore: CHORE, form: form(), memberCount: 3 }),
    ).toEqual({ ok: true, patch: {}, unchanged: true });
  });

  it("sends only the title when it changed", () => {
    expect(
      buildChorePatch({
        chore: CHORE,
        form: form({ title: "ظرف و قابلمه" }),
        memberCount: 1,
      }),
    ).toEqual({
      ok: true,
      patch: { title: "ظرف و قابلمه" },
      unchanged: false,
    });
  });

  it("ignores whitespace-only differences in the title", () => {
    const result = buildChorePatch({
      chore: CHORE,
      form: form({ title: "  شستن   ظرف‌ها " }),
      memberCount: 1,
    });

    expect(result).toEqual({ ok: true, patch: {}, unchanged: true });
  });

  it("rejects a too-short title", () => {
    expect(
      buildChorePatch({
        chore: CHORE,
        form: form({ title: " ش " }),
        memberCount: 2,
      }),
    ).toEqual({
      ok: false,
      message: "عنوان کار خانه باید حداقل ۲ کاراکتر باشد.",
    });
  });

  it("rejects a too-long title", () => {
    const result = buildChorePatch({
      chore: CHORE,
      form: form({ title: "x".repeat(181) }),
      memberCount: 2,
    });

    expect(result).toEqual({
      ok: false,
      message: "عنوان کار خانه بیش از حد طولانی است.",
    });
  });

  it("sends only the frequency when it changed", () => {
    const result = buildChorePatch({
      chore: CHORE,
      form: form({ frequency: "DAILY" }),
      memberCount: 2,
    });

    expect(result).toEqual({
      ok: true,
      patch: { frequency: "DAILY" },
      unchanged: false,
    });
  });

  it("refuses rotation in a one-person household", () => {
    expect(
      buildChorePatch({
        chore: CHORE,
        form: form({ rotationMode: "ROTATING" }),
        memberCount: 1,
      }),
    ).toEqual({
      ok: false,
      message: "برای چرخش نوبت، خانه باید حداقل دو عضو داشته باشد.",
    });
  });

  it("allows rotation with two or more members", () => {
    expect(
      buildChorePatch({
        chore: CHORE,
        form: form({ rotationMode: "ROTATING" }),
        memberCount: 2,
      }),
    ).toEqual({
      ok: true,
      patch: { rotationMode: "ROTATING" },
      unchanged: false,
    });
  });

  it("allows switching back to FIXED regardless of member count", () => {
    const rotating = { ...CHORE, rotation_mode: "ROTATING" as const };

    expect(
      buildChorePatch({
        chore: rotating,
        form: form({ rotationMode: "FIXED" }),
        memberCount: 1,
      }),
    ).toEqual({ ok: true, patch: { rotationMode: "FIXED" }, unchanged: false });
  });

  it("can change title and frequency together", () => {
    const result = buildChorePatch({
      chore: CHORE,
      form: form({ title: "جارو زدن", frequency: "MONTHLY" }),
      memberCount: 4,
    });

    expect(result.ok && result.patch).toEqual({
      title: "جارو زدن",
      frequency: "MONTHLY",
    });
  });

  it("accepts an empty patch guard for a chore with an unusual frequency", () => {
    const yearly = { ...CHORE, frequency: "YEARLY" as const };

    expect(
      buildChorePatch({
        chore: yearly,
        form: toChoreForm(yearly),
        memberCount: 1,
      }),
    ).toEqual({ ok: true, patch: {}, unchanged: true });
  });
});
