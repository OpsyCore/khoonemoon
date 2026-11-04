import { describe, expect, it } from "vitest";
import { financeCorrection } from "../../../mobile/src/finance-correction";
import type { FinancialRecord } from "./types";
import { toLocalDateTimeValue } from "./corrections";
const record = {
  title: "برق",
  amount: 100,
  category: null,
  note: null,
  due_at: "2026-10-01T12:00:30.123Z",
  record_type: "BILL",
} as FinancialRecord;
const form = {
  title: "برق",
  amount: "100",
  category: "",
  note: "",
  due: toLocalDateTimeValue(record.due_at),
};
describe("mobile finance correction", () => {
  it("keeps the exact original instant and sends only changed fields", () => {
    expect(financeCorrection(record, form)).toEqual({});
    expect(
      financeCorrection(
        { ...record, due_at: "2026-10-01T12:00:30.123+00:00" },
        form,
      ),
    ).toEqual({});
    expect(financeCorrection(record, { ...form, amount: "120" })).toEqual({
      amount: 120,
    });
    expect(financeCorrection(record, { ...form, note: "متن" })).toEqual({
      note: "متن",
    });
  });
  it("rejects invalid amounts and removing a bill due date", () => {
    expect(() => financeCorrection(record, { ...form, amount: "" })).toThrow();
    expect(() => financeCorrection(record, { ...form, due: "" })).toThrow();
  });
});
