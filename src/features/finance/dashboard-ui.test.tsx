// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Finance } from "../../../mobile/src/finance";
import type { FinancialRecord } from "./types";
const mock = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));
vi.mock("@/features/finance/direct-client", () => ({
  directFinance: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const row: FinancialRecord = {
  id: "bill1",
  household_id: null,
  owner_id: "u",
  created_by: "u",
  visibility: "PRIVATE",
  record_type: "BILL",
  title: "قبض واقعی",
  amount: 300,
  currency: "IRR",
  category: "مسکن",
  note: null,
  occurred_at: "2026-10-28T12:00:00Z",
  due_at: "2026-11-20T12:00:00Z",
  bill_status: "UPCOMING",
  is_recurring: false,
  recurrence_rule: null,
  paid_by: null,
  paid_at: null,
  archived_at: null,
  created_at: "2026-10-28T12:00:00Z",
  updated_at: "2026-10-28T12:00:00Z",
};
function client() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    channel: () => channel,
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
}
it("renders real unpaid bills, opens the form and filters categories without inventing records", async () => {
  mock.list.mockResolvedValue([row]);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Finance
        client={client()}
        householdId={null}
        initialUrl="https://local.invalid/finance"
      />,
    );
  });
  expect(host.querySelector(".fin-bills")?.textContent).toContain("قبض واقعی");
  expect(host.querySelector(".fin-month.expense")?.textContent).toContain("۰");
  await act(async () => {
    (host.querySelector(".fin-bills button") as HTMLButtonElement).click();
  });
  expect(host.textContent).toContain("ویرایش مورد مالی");
  expect(host.textContent).toContain("پرداخت شد");
  const housing = [
    ...host.querySelectorAll<HTMLButtonElement>(".fin-categories button"),
  ].find((x) => x.textContent === "مسکن")!;
  await act(async () => housing.click());
  expect(host.querySelector(".finance-details")?.textContent).toContain(
    "دسته انتخاب‌شده: مسکن",
  );
  expect(
    new URL(window.location.href).searchParams.get("ledger_category"),
  ).toBe("مسکن");
  const category = [
    ...host.querySelectorAll<HTMLButtonElement>(".fin-categories button"),
  ].find((x) => x.textContent === "درآمد")!;
  await act(async () => category.click());
  expect(
    (host.querySelector(".finance-details") as HTMLDetailsElement).open,
  ).toBe(true);
  const selects = [
    ...host.querySelectorAll<HTMLSelectElement>(".finance-details select"),
  ];
  expect(selects[0].value).toBe("INCOME");
  expect(
    new URL(window.location.href).searchParams.has("ledger_category"),
  ).toBe(false);
  expect(
    (host.querySelector(".finance-details input") as HTMLInputElement).value,
  ).toBe("");
  await act(async () => root.unmount());
});
