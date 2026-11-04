// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { CalendarEvents } from "../../../mobile/src/calendar";

const mocks = vi.hoisted(() => ({
  calendarList: vi.fn(),
  taskList: vi.fn(),
  financeList: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/features/calendar/direct-client", () => ({
  directCalendar: () => ({
    list: mocks.calendarList,
    create: mocks.create,
    remove: mocks.remove,
  }),
}));
vi.mock("@/features/tasks/direct-client", () => ({
  directTasks: () => ({ list: mocks.taskList }),
}));
vi.mock("@/features/finance/direct-client", () => ({
  directFinance: () => ({ list: mocks.financeList }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

it("shows real calendar records and supports views, event creation and deletion", async () => {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  const event = {
    id: "event-1",
    title: "دیدار واقعی",
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    location: "خانه",
    visibility: "PRIVATE",
    all_day: false,
  };
  mocks.calendarList.mockResolvedValue([event]);
  mocks.taskList.mockResolvedValue([]);
  mocks.financeList.mockResolvedValue([
    {
      id: "bill-1",
      title: "قبض واقعی",
      due_at: start.toISOString(),
      record_type: "BILL",
      visibility: "PRIVATE",
    },
  ]);
  mocks.create.mockResolvedValue({
    ...event,
    id: "event-2",
    title: "رویداد جدید",
  });
  mocks.remove.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => {
    root.render(
      <CalendarEvents
        client={{} as SupabaseClient}
        householdId={null}
        onHouse={vi.fn()}
      />,
    );
  });
  expect(node.textContent).toContain("دیدار واقعی");
  expect(node.textContent).toContain("قبض واقعی");
  expect(node.querySelectorAll(".calendar-dot.is-bill").length).toBeGreaterThan(
    1,
  );
  const button = (label: string) =>
    Array.from(node.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === label,
    )!;
  await act(async () => button("هفته").click());
  expect(node.querySelectorAll(".calendar-week-strip button")).toHaveLength(7);
  await act(async () => button("برنامه‌ها").click());
  expect(node.textContent).toContain("برنامه‌های پیش رو");
  await act(async () => button("ماه").click());
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="افزودن رویداد"]')!
      .click(),
  );
  expect(node.querySelector("dialog")!.open).toBe(true);
  const input = node.querySelector<HTMLInputElement>(
    'input[required][minlength="2"]',
  )!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, "رویداد جدید");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(node.querySelector("dialog")!.open).toBe(false);
  expect(node.textContent).toContain("رویداد جدید");
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="حذف دیدار واقعی"]')!
      .click(),
  );
  expect(mocks.remove).toHaveBeenCalledWith("event-1");
  expect(node.textContent).not.toContain("دیدار واقعی");
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});
