// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Today } from "../../../mobile/src/today";
const mocks = vi.hoisted(() => ({ today: vi.fn(), summary: vi.fn() }));
vi.mock("@/features/summary/today-client", () => ({ getToday: mocks.today }));
vi.mock("@/features/summary/direct-client", () => ({
  getMobileWeeklySummary: mocks.summary,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
it("renders cards in visual and keyboard order, even with unequal content", async () => {
  const date = "2026-11-03T09:00:00.000Z";
  mocks.today.mockResolvedValue({
    tasks: [],
    chores: [{ id: "c", title: "کار خانه", next_due_at: date }],
    upcomingEvents: [{ id: "e", title: "رویداد", start_at: date }],
    upcomingBills: [{ id: "b", title: "قبض", due_at: date }],
    reminders: [],
  });
  mocks.summary.mockRejectedValue(new Error("unavailable"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const navigate = vi.fn();
  await act(async () =>
    root.render(
      <Today
        client={{} as SupabaseClient}
        onNavigate={navigate}
        onTaskChanged={vi.fn()}
      />,
    ),
  );
  const cards = [
    ...host.querySelectorAll<HTMLElement>(".today-ref-grid > .today-ref-card"),
  ];
  expect(
    cards.map((card) =>
      [...card.classList].find((name) => name !== "today-ref-card"),
    ),
  ).toEqual([
    "today-ref-tasks",
    "today-ref-events",
    "today-ref-chores",
    "today-ref-bills",
    "today-ref-reminders",
  ]);
  expect(cards[2].textContent).toContain("کار خانه");
  expect(cards[3].textContent).toContain("قبض");
  await act(async () =>
    cards[2].querySelector<HTMLButtonElement>(".today-ref-more")!.click(),
  );
  expect(navigate).toHaveBeenCalledWith("tasks", "chore-list");
  await act(async () => root.unmount());
});
it("uses shared stretched grid rows and switches to one column on narrow screens", () => {
  const css = readFileSync("mobile/src/today.css", "utf8");
  expect(css).toMatch(
    /grid-template-areas:\s*"tasks events"\s*"chores bills"\s*"reminders reminders"/,
  );
  expect(css).toContain("align-items: stretch");
  expect(css).toMatch(
    /@media \(max-width: 350px\)[\s\S]*grid-template-areas:\s*"tasks"\s*"events"\s*"chores"\s*"bills"\s*"reminders"/,
  );
});
