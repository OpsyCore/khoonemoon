import type { ChoreRecord } from "@/features/chores/types";

/**
 * Correcting a chore ("اصلاح کار خانه").
 *
 * `PATCH /api/chores/[id]` has existed since M7 (and DELETE archives the chore),
 * but the board only ever used it to pause a chore. A typo in a title or a wrong
 * frequency was permanent. This module builds the smallest valid patch, mirroring
 * the server rules so the user gets a Persian message instead of a generic 400.
 */

export type ChoreFrequency = ChoreRecord["frequency"];
export type ChoreRotationMode = ChoreRecord["rotation_mode"];

export type ChoreForm = {
  title: string;
  frequency: ChoreFrequency;
  rotationMode: ChoreRotationMode;
};

export type ChorePatch = {
  title?: string;
  frequency?: ChoreFrequency;
  rotationMode?: ChoreRotationMode;
};

export type ChoreCorrection =
  | { ok: true; patch: ChorePatch; unchanged: boolean }
  | { ok: false; message: string };

/** Frequencies the UI offers. `NONE`/`YEARLY` are valid in the DB but have no
 * dedicated control, so a chore already using one keeps it visible. */
export const EDITABLE_FREQUENCIES: ChoreFrequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
];

export const FREQUENCY_LABELS: Record<ChoreFrequency, string> = {
  NONE: "بدون تکرار",
  DAILY: "هر روز",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
  YEARLY: "سالانه",
  INTERVAL_DAYS: "هر چند روز",
};

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function toChoreForm(
  chore: Pick<ChoreRecord, "title" | "frequency" | "rotation_mode">,
): ChoreForm {
  return {
    title: chore.title,
    frequency: chore.frequency,
    rotationMode: chore.rotation_mode,
  };
}

/**
 * Rotation needs at least two people to be meaningful, so switching a chore to
 * ROTATING in a one-person household is refused here rather than silently
 * producing a rotation that never rotates.
 */
export function buildChorePatch({
  chore,
  form,
  memberCount,
}: {
  chore: Pick<ChoreRecord, "title" | "frequency" | "rotation_mode">;
  form: ChoreForm;
  memberCount: number;
}): ChoreCorrection {
  const patch: ChorePatch = {};

  const title = normalizeTitle(form.title);

  if (title.length < 2) {
    return { ok: false, message: "عنوان کار خانه باید حداقل ۲ کاراکتر باشد." };
  }

  if (title.length > 180) {
    return { ok: false, message: "عنوان کار خانه بیش از حد طولانی است." };
  }

  if (title !== normalizeTitle(chore.title)) patch.title = title;

  if (form.frequency !== chore.frequency) patch.frequency = form.frequency;

  if (form.rotationMode !== chore.rotation_mode) {
    if (form.rotationMode === "ROTATING" && memberCount < 2) {
      return {
        ok: false,
        message: "برای چرخش نوبت، خانه باید حداقل دو عضو داشته باشد.",
      };
    }

    patch.rotationMode = form.rotationMode;
  }

  return { ok: true, patch, unchanged: Object.keys(patch).length === 0 };
}

export const CHORE_ARCHIVE_LABEL = "بایگانی";
export const CHORE_ARCHIVE_HINT =
  "کار خانه از فهرست و نوبت‌ها کنار می‌رود ولی تاریخچهٔ انجام‌شدن‌ها می‌ماند.";
