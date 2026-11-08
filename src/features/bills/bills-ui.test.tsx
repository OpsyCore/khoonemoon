// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Bills } from "../../../mobile/src/bills";
import type { FinancialRecord } from "@/features/finance/types";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/features/finance/direct-client", () => ({
  directFinance: () => api,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const row: FinancialRecord = {
  id: "bill",
  household_id: null,
  owner_id: "u",
  created_by: "u",
  visibility: "PRIVATE",
  record_type: "BILL",
  title: "قبض آب واقعی",
  amount: 300,
  currency: "IRR",
  category: "آب",
  note: null,
  occurred_at: "2026-10-01T00:00:00Z",
  due_at: "2027-10-20T12:00:00Z",
  bill_status: "UPCOMING",
  is_recurring: false,
  recurrence_rule: null,
  paid_by: null,
  paid_at: null,
  archived_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};
it("shows real records, filters, confirms a manual payment and links existing reminder and finance screens", async () => {
  api.list.mockResolvedValue([row]);
  api.update.mockResolvedValue({ ...row, paid_at: new Date().toISOString() });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const reminders = vi.fn(),
    finance = vi.fn(),
    host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Bills
        client={{} as SupabaseClient}
        householdId={null}
        onReminders={reminders}
        onFinance={finance}
      />,
    ),
  );
  expect(host.querySelector(".bills-upcoming")?.textContent).toContain(
    "قبض آب واقعی",
  );
  const cats = [...host.querySelectorAll<HTMLButtonElement>(".bills-category")];
  await act(async () => cats[0].click());
  expect(host.querySelector(".bills-upcoming")?.textContent).not.toContain(
    "قبض آب واقعی",
  );
  await act(async () => cats[0].click());
  await act(async () =>
    (host.querySelector(".bill-status") as HTMLButtonElement).click(),
  );
  expect(window.confirm).toHaveBeenCalled();
  expect(api.update).toHaveBeenCalledWith(
    "bill",
    { paid: true },
    row.updated_at,
  );
  await act(async () =>
    (host.querySelector(".bills-bell") as HTMLButtonElement).click(),
  );
  expect(reminders).toHaveBeenCalled();
  const financeButton = [
    ...host.querySelectorAll(".bills-utilities button"),
  ].find((b) => b.textContent?.includes("مالی")) as HTMLButtonElement;
  await act(async () => financeButton.click());
  expect(finance).toHaveBeenCalled();
  await act(async () =>
    (host.querySelector(".bills-add") as HTMLButtonElement).click(),
  );
  expect(host.querySelector("form")?.textContent).toContain("ثبت قبض جدید");
  await act(async () => root.unmount());
});
it("does not present a zero summary as data when loading fails", async () => {
  api.list.mockRejectedValue(new Error("offline"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Bills
        client={{} as SupabaseClient}
        householdId={null}
        onReminders={() => {}}
        onFinance={() => {}}
      />,
    ),
  );
  expect(host.textContent).toContain("ناموفق");
  expect(host.querySelector(".bills-summary")).toBeNull();
  await act(async () => root.unmount());
});
it("creates a private bill with the selected service and validated fields", async () => {
  api.list.mockResolvedValue([]);
  api.create.mockResolvedValue(row);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Bills
        client={{} as SupabaseClient}
        householdId={null}
        onReminders={() => {}}
        onFinance={() => {}}
      />,
    ),
  );
  await act(async () =>
    (host.querySelector(".bills-add") as HTMLButtonElement).click(),
  );
  const inputs = [
    ...host.querySelectorAll<HTMLInputElement>(".bills-form input"),
  ];
  function setInput(el: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await act(async () => {
    setInput(inputs[1], "۱۲۵۰۰۰");
    setInput(inputs[2], "2026-12-25T10:30");
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "قبض برق",
      category: "برق",
      amount: 125000,
      visibility: "PRIVATE",
      recordType: "BILL",
      currency: "IRR",
    }),
  );
  expect(host.textContent).toContain("قبض ثبت شد");
  await act(async () => root.unmount());
});
