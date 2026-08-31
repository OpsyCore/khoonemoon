import { describe, expect, it } from "vitest";
import type { FinanceFormState } from "./finance-form";
import {
  buildCreateFinancePayload,
  buildPayAction,
  buildUnpayAction,
  buildUpdateAction,
  canPayFinanceRecord,
  canStartFinanceMutation,
  validateFinanceFormClient,
} from "./finance-payload";

const billForm: FinanceFormState = {
  recordType: "BILL",
  title: "  برق  ",
  amount: "120000",
  currency: "IRR",
  visibility: "HOUSEHOLD_SHARED",
  dueAt: "2026-08-27T20:00",
  occurredAt: "2026-08-26T08:00",
  category: "خانه",
  note: "یادداشت",
};

const expenseForm: FinanceFormState = {
  ...billForm,
  recordType: "EXPENSE",
  title: "نان",
};

describe("finance create payload", () => {
  it("includes BILL fields and omits occurredAt", () => {
    const payload = buildCreateFinancePayload(billForm, true);
    expect(payload.recordType).toBe("BILL");
    expect(payload.title).toBe("برق");
    expect(payload.amount).toBe(120000);
    expect(payload.currency).toBe("IRR");
    expect(payload.visibility).toBe("HOUSEHOLD_SHARED");
    expect("dueAt" in payload).toBe(true);
    expect(payload).not.toHaveProperty("occurredAt");
    expect(payload).not.toHaveProperty("ownerId");
    expect(payload).not.toHaveProperty("createdBy");
    expect(payload).not.toHaveProperty("householdId");
    expect(payload).not.toHaveProperty("paidAt");
    expect(payload).not.toHaveProperty("paidBy");
    expect(payload).not.toHaveProperty("owner_id");
    expect(payload).not.toHaveProperty("created_by");
    expect(payload).not.toHaveProperty("household_id");
    expect(payload).not.toHaveProperty("paid_at");
    expect(payload).not.toHaveProperty("paid_by");
  });

  it("includes EXPENSE fields and omits dueAt", () => {
    const payload = buildCreateFinancePayload(expenseForm, false);
    expect(payload.recordType).toBe("EXPENSE");
    expect(payload.visibility).toBe("PRIVATE");
    expect("occurredAt" in payload).toBe(true);
    expect(payload).not.toHaveProperty("dueAt");
  });
});

describe("finance update/pay/delete mapping", () => {
  it("maps update without type, visibility, or paid fields", () => {
    const payload = buildUpdateAction(billForm, "BILL");
    expect(payload).toEqual({
      action: "update",
      data: expect.objectContaining({
        title: "برق",
        amount: 120000,
      }),
    });
    expect(payload.data).not.toHaveProperty("recordType");
    expect(payload.data).not.toHaveProperty("visibility");
    expect(payload.data).not.toHaveProperty("occurredAt");
    expect(payload.data).not.toHaveProperty("paidAt");
    expect(payload.data).not.toHaveProperty("ownerId");
  });

  it("maps pay and unpay actions", () => {
    expect(buildPayAction()).toEqual({ action: "pay" });
    expect(buildUnpayAction()).toEqual({ action: "unpay" });
  });

  it("allows pay/unpay only for bills", () => {
    expect(canPayFinanceRecord("BILL")).toBe(true);
    expect(canPayFinanceRecord("EXPENSE")).toBe(false);
  });

  it("rejects invalid BILL/EXPENSE form input", () => {
    expect(validateFinanceFormClient({ ...billForm, dueAt: "" }, "BILL")).toBe(
      "تاریخ سررسید قبض را وارد کنید.",
    );
    expect(
      validateFinanceFormClient({ ...expenseForm, occurredAt: "" }, "EXPENSE"),
    ).toBe("تاریخ وقوع هزینه را وارد کنید.");
    expect(
      validateFinanceFormClient({ ...billForm, amount: "0" }, "BILL"),
    ).toBe("مبلغ باید یک عدد مثبت باشد.");
    expect(
      validateFinanceFormClient({ ...billForm, title: "   " }, "BILL"),
    ).toBe("عنوان را وارد کنید.");
    expect(
      validateFinanceFormClient(
        { ...billForm, title: "آ".repeat(181) },
        "BILL",
      ),
    ).toBe("عنوان نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.");
    expect(
      validateFinanceFormClient({ ...billForm, amount: "-5" }, "BILL"),
    ).toBe("مبلغ باید یک عدد مثبت باشد.");
  });

  it("prevents a second mutation while one is pending", () => {
    expect(canStartFinanceMutation(null)).toBe(true);
    expect(canStartFinanceMutation("rec-1")).toBe(false);
  });
});
