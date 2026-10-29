import { describe, expect, it } from "vitest";
import {
  buildCorrectionPatch,
  describePatch,
  fromLocalDateTimeValue,
  toCorrectionForm,
  toLocalDateTimeValue,
  type EditableRecord,
} from "@/features/finance/corrections";

const RECORD: EditableRecord = {
  title: "قبض برق",
  amount: 450_000,
  category: "خانه",
  due_at: "2026-11-01T09:30:00.000Z",
};

function form(overrides: Partial<ReturnType<typeof toCorrectionForm>> = {}) {
  return { ...toCorrectionForm(RECORD), ...overrides };
}

describe("toCorrectionForm", () => {
  it("fills the form from the record", () => {
    const values = toCorrectionForm(RECORD);

    expect(values.title).toBe("قبض برق");
    expect(values.amount).toBe("450000");
    expect(values.category).toBe("خانه");
    expect(values.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("uses empty strings for missing category and due date", () => {
    const values = toCorrectionForm({
      title: "خرید",
      amount: "12000",
      category: null,
      due_at: null,
    });

    expect(values.category).toBe("");
    expect(values.dueAt).toBe("");
    expect(values.amount).toBe("12000");
  });

  it("survives a numeric string from Postgres", () => {
    expect(toCorrectionForm({ ...RECORD, amount: "125000.50" }).amount).toBe(
      "125000.5",
    );
  });
});

describe("toLocalDateTimeValue / fromLocalDateTimeValue", () => {
  it("round-trips an ISO timestamp", () => {
    const local = toLocalDateTimeValue("2026-11-01T09:30:00.000Z");

    expect(fromLocalDateTimeValue(local)).toBe("2026-11-01T09:30:00.000Z");
  });

  it("returns an empty string for null or invalid input", () => {
    expect(toLocalDateTimeValue(null)).toBe("");
    expect(toLocalDateTimeValue("nope")).toBe("");
  });

  it("returns null for an empty or unusable datetime-local value", () => {
    expect(fromLocalDateTimeValue("")).toBeNull();
    expect(fromLocalDateTimeValue("   ")).toBeNull();
    expect(fromLocalDateTimeValue("not-a-date")).toBeNull();
  });
});

describe("buildCorrectionPatch", () => {
  it("reports no change when nothing was edited", () => {
    const result = buildCorrectionPatch({ record: RECORD, form: form() });

    expect(result).toEqual({ ok: true, patch: {}, unchanged: true });
  });

  it("sends only the changed amount", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ amount: "500000" }),
    });

    expect(result).toEqual({
      ok: true,
      patch: { amount: 500_000 },
      unchanged: false,
    });
  });

  it("accepts Persian digits and separators in the amount", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ amount: "۵۰۰٬۰۰۰" }),
    });

    expect(result.ok && result.patch.amount).toBe(500_000);
  });

  it("does not flag an unchanged amount typed with separators", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ amount: "450,000" }),
    });

    expect(result).toEqual({ ok: true, patch: {}, unchanged: true });
  });

  it("trims and collapses whitespace in the title", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ title: "  قبض   برق خانه " }),
    });

    expect(result.ok && result.patch.title).toBe("قبض برق خانه");
  });

  it("does not report a title change caused only by whitespace", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ title: "  قبض برق  " }),
    });

    expect(result).toEqual({ ok: true, patch: {}, unchanged: true });
  });

  it("clears the category when the field is emptied", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ category: "  " }),
    });

    expect(result.ok && result.patch.category).toBeNull();
  });

  it("clears the due date when the field is emptied", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ dueAt: "" }),
    });

    expect(result.ok && result.patch.dueAt).toBeNull();
  });

  it("sends an ISO due date when the field changed", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ dueAt: "2026-12-05T18:00" }),
    });

    expect(result.ok && typeof result.patch.dueAt).toBe("string");
    expect(
      new Date(
        (result as { patch: { dueAt: string } }).patch.dueAt,
      ).toISOString(),
    ).toBe(new Date("2026-12-05T18:00").toISOString());
  });

  it("rejects a title that is too short", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ title: " ب " }),
    });

    expect(result).toEqual({
      ok: false,
      field: "title",
      message: "عنوان باید حداقل ۲ کاراکتر باشد.",
    });
  });

  it("rejects a title that is too long", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ title: "x".repeat(181) }),
    });

    expect(result.ok).toBe(false);
  });

  it("rejects an empty or non-numeric amount", () => {
    for (const amount of ["", "   ", "abc", "-5"]) {
      const result = buildCorrectionPatch({
        record: RECORD,
        form: form({ amount }),
      });

      expect(result).toEqual({
        ok: false,
        field: "amount",
        message: "مبلغ را به عدد وارد کنید.",
      });
    }
  });

  it("accepts zero as a valid correction", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ amount: "0" }),
    });

    expect(result).toEqual({
      ok: true,
      patch: { amount: 0 },
      unchanged: false,
    });
  });

  it("rejects an absurdly large amount", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ amount: "9999999999999" }),
    });

    expect(result).toEqual({
      ok: false,
      field: "amount",
      message: "مبلغ بیش از حد بزرگ است.",
    });
  });

  it("rejects a category that is too long", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ category: "x".repeat(61) }),
    });

    expect(result.ok).toBe(false);
  });

  it("can change several fields at once", () => {
    const result = buildCorrectionPatch({
      record: RECORD,
      form: form({ title: "قبض برق خانه", amount: "470000", category: "قبض" }),
    });

    expect(result.ok && result.patch).toEqual({
      title: "قبض برق خانه",
      amount: 470_000,
      category: "قبض",
    });
  });
});

describe("describePatch", () => {
  it("lists the changed fields in Persian", () => {
    expect(describePatch({ amount: 1, category: null })).toEqual([
      "مبلغ",
      "دسته",
    ]);
    expect(describePatch({})).toEqual([]);
  });
});
