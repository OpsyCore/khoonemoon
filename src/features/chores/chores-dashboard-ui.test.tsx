// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChoresDashboard } from "../../../mobile/src/chores-dashboard";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  history: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/features/chores/direct-client", () => ({
  directChores: () => ({
    list: mocks.list,
    householdHistory: mocks.history,
    completeVersion: mocks.complete,
  }),
}));
vi.mock("../../../mobile/src/chores", () => ({
  Chores: () => <div>فرم مدیریت واقعی</div>,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("shows real assignee and weekly counts, opens history, and completes with the expected revision", async () => {
  const due = new Date();
  const item = {
    id: "c1",
    title: "شستن ظرف‌ها",
    household_id: "h",
    rotation_mode: "FIXED",
    current_rotation_index: 0,
    frequency: "DAILY",
    next_due_at: due.toISOString(),
    is_active: true,
    archived_at: null,
    completion_revision: 8,
    chore_rotation_steps: [
      { id: "s", chore_id: "c1", position: 0, assignee_id: "u1" },
    ],
  };
  mocks.list.mockResolvedValue([item]);
  mocks.history.mockResolvedValue([
    {
      id: "h1",
      chore_id: "c1",
      completed_by: "u1",
      completed_at: due.toISOString(),
      due_at: null,
      note: null,
      chores: { id: "c1", title: "شستن ظرف‌ها" },
    },
  ]);
  mocks.complete.mockResolvedValue(undefined);
  const client = {
    rpc: vi.fn().mockResolvedValue({
      data: [{ id: "u1", full_name: "سارا" }],
      error: null,
    }),
  } as unknown as SupabaseClient;
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ChoresDashboard
        client={client}
        householdId="h"
        onSettings={vi.fn()}
        onHouse={vi.fn()}
      />,
    ),
  );
  expect(host.textContent).toContain("نوبت امروز با سارا");
  expect(host.textContent).toContain("۱ کار برای امروز");
  expect(
    host.querySelector('[role="meter"]')?.getAttribute("aria-valuenow"),
  ).toBe("100");
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".chore-ref-row button")!.click(),
  );
  expect(mocks.complete).toHaveBeenCalledWith("c1", 8);
  expect(host.textContent).toContain("انجام کار ثبت شد");
  await act(async () =>
    [
      ...host.querySelectorAll<HTMLButtonElement>(".chore-ref-tabs button"),
    ][1].click(),
  );
  expect(host.textContent).toContain("تاریخچه انجام کارها");
  expect(host.textContent).toContain("توسط سارا");
  await act(async () => root.unmount());
});
it("does not show fabricated empty counts or allow writes after a failed load", async () => {
  mocks.list.mockRejectedValue(new Error("offline"));
  mocks.history.mockResolvedValue([]);
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  } as unknown as SupabaseClient;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ChoresDashboard
        client={client}
        householdId="h"
        onSettings={vi.fn()}
        onHouse={vi.fn()}
      />,
    ),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("ناموفق");
  expect(host.textContent).toContain("نوبت‌ها در دسترس نیستند");
  expect(host.querySelector('[role="meter"]')).toBeNull();
  await act(async () => root.unmount());
});
it("blocks further completion when the result is ambiguous until fresh data is loaded", async () => {
  const due = new Date();
  const item = {
    id: "c1",
    title: "جارو زدن",
    household_id: "h",
    rotation_mode: "FIXED",
    current_rotation_index: 0,
    frequency: "DAILY",
    next_due_at: due.toISOString(),
    is_active: true,
    archived_at: null,
    completion_revision: 3,
    chore_rotation_steps: [],
  };
  mocks.list.mockResolvedValue([item]);
  mocks.history.mockResolvedValue([]);
  mocks.complete.mockRejectedValue(new Error("lost response"));
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  } as unknown as SupabaseClient;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ChoresDashboard
        client={client}
        householdId="h"
        onSettings={vi.fn()}
        onHouse={vi.fn()}
      />,
    ),
  );
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".chore-ref-row button")!.click(),
  );
  expect(mocks.complete).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("نتیجه ثبت انجام مشخص نیست");
  expect(host.querySelector(".chore-ref-row button")).toBeNull();
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".chore-ref-error button")!.click(),
  );
  expect(host.querySelector(".chore-ref-row button")).not.toBeNull();
  await act(async () => root.unmount());
});
