// @vitest-environment jsdom
import { readFileSync } from "node:fs";
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
  expect(host.querySelector(".fin-ledger-header")?.textContent).toContain(
    "دفتر مالی",
  );
  expect(host.querySelectorAll(".fin-ledger-stat")).toHaveLength(3);
  expect(host.querySelectorAll(".fin-ledger-type-filters button")).toHaveLength(
    7,
  );
  expect(
    host.querySelectorAll(".fin-ledger-status-filters button"),
  ).toHaveLength(4);
  expect(host.querySelector(".fin-ledger-table")?.textContent).toContain(
    "قبض واقعی",
  );
  await act(async () => {
    (host.querySelector(".finance-more-dashboard") as HTMLDetailsElement).open =
      true;
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
  expect(host.querySelector(".fin-ledger-filter-foot")?.textContent).toContain(
    "حذف دستهٔ «مسکن»",
  );
  expect(
    new URL(window.location.href).searchParams.get("ledger_category"),
  ).toBe("مسکن");
  const category = [
    ...host.querySelectorAll<HTMLButtonElement>(".fin-categories button"),
  ].find((x) => x.textContent === "درآمد")!;
  await act(async () => category.click());
  expect(
    (host.querySelector(".finance-more-dashboard") as HTMLDetailsElement).open,
  ).toBe(true);
  expect(
    [
      ...host.querySelectorAll<HTMLButtonElement>(
        ".fin-ledger-type-filters button",
      ),
    ].find((button) => button.getAttribute("aria-pressed") === "true")
      ?.textContent,
  ).toBe("درآمد");
  expect(
    new URL(window.location.href).searchParams.has("ledger_category"),
  ).toBe(false);
  expect(
    (host.querySelector(".fin-ledger-search input") as HTMLInputElement).value,
  ).toBe("");
  expect(host.querySelectorAll(".fin-categories button")).toHaveLength(8);
  await act(async () => root.unmount());
});

it("keeps the finance reference cards side by side on narrow phones", () => {
  const css = readFileSync("mobile/src/finance-overview.css", "utf8");
  expect(css).toMatch(
    /\.fin-month-grid,\s*\.fin-middle,\s*\.fin-members\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  expect(css).not.toMatch(
    /@media \(max-width: 380px\)\s*\{[^}]*\.fin-middle\s*\{[^}]*grid-template-columns:\s*1fr/,
  );
  expect(css).toMatch(
    /\.fin-categories > div\s*\{[^}]*grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/,
  );
});
