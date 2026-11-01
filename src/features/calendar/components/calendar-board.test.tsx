// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CalendarBoard } from "./calendar-board";
import type { EventRecord } from "@/features/calendar/types";
import type { FinancialRecord } from "@/features/finance/types";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), create: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    const channel = { on: () => channel, subscribe: () => channel };
    return { channel: () => channel, removeChannel: () => Promise.resolve() };
  },
}));
vi.mock("@/features/calendar/direct-client", () => ({
  directCalendar: () => ({ create: mocks.create }),
}));
vi.mock("@/features/reminders/components/reminder-composer", () => ({
  ReminderComposer: () => <button type="button">یادآور</button>,
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

it("shows real bill and overlapping event, navigates views and opens the event editor", async () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(10, 0, 0, 0);
  const event = {
    id: "event-1",
    title: "دیدار واقعی",
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: false,
    location: "خانه",
    visibility: "PRIVATE",
    description: null,
    household_id: null,
  } as EventRecord;
  const bill = {
    id: "bill-1",
    title: "قبض واقعی",
    due_at: now.toISOString(),
    record_type: "BILL",
  } as FinancialRecord;
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () =>
    root.render(
      <CalendarBoard
        tasks={[]}
        events={[event]}
        householdId={null}
        chores={[]}
        choresLoadError={false}
        bills={[bill]}
        billsLoadError={false}
      />,
    ),
  );
  expect(node.textContent).toContain("دیدار واقعی");
  expect(node.textContent).toContain("قبض واقعی");
  expect(
    node.querySelectorAll(".web-calendar-dot.type-event").length,
  ).toBeGreaterThan(2);
  expect(
    node.querySelectorAll(".web-calendar-dot.type-bill").length,
  ).toBeGreaterThan(1);
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="ویرایش دیدار واقعی"]')!
      .click(),
  );
  expect(node.querySelector("dialog")!.open).toBe(true);
  expect(node.querySelector("dialog")!.textContent).toContain("ویرایش رویداد");
  await act(async () =>
    node.querySelector<HTMLButtonElement>('[aria-label="بستن فرم"]')!.click(),
  );
  expect(node.querySelector("dialog")!.open).toBe(false);
  const button = (text: string) =>
    Array.from(node.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text,
    )!;
  await act(async () => button("هفته").click());
  expect(node.querySelectorAll(".web-calendar-week-strip button")).toHaveLength(
    7,
  );
  expect(node.textContent).toContain("دیدار واقعی");
  await act(async () => button("برنامه‌ها").click());
  expect(node.textContent).toContain("۹۰ روز آینده");
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="افزودن رویداد"]')!
      .click(),
  );
  expect(node.querySelector("dialog")!.open).toBe(true);
  await act(async () => root.unmount());
});
