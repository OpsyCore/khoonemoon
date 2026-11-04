// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { NewTask, parseFollowup } from "../../../mobile/src/new-task";
const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  createReminder: vi.fn(),
}));
vi.mock("@/features/tasks/direct-client", () => ({
  directTasks: () => ({ create: mocks.createTask }),
}));
vi.mock("@/features/reminders/direct-client", () => ({
  directReminders: () => ({ createTaskReminderOnce: mocks.createReminder }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const id = "00000000-0000-4000-8000-000000000001";
it("retains an already-created task and retries only the reminder", async () => {
  mocks.createTask.mockResolvedValue(id);
  mocks.createReminder
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    done = vi.fn();
  await act(async () =>
    root.render(
      <NewTask
        client={{} as SupabaseClient}
        userId="user"
        householdId={null}
        onDone={done}
        onCancel={vi.fn()}
      />,
    ),
  );
  const title = host.querySelector<HTMLInputElement>(
    'input[placeholder^="مثلاً"]',
  )!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(title, "تسک تازه");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".new-task-date-button")!.click(),
  );
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="ماه بعد"]')!.click(),
  );
  const day = [
    ...host.querySelectorAll<HTMLButtonElement>(
      ".new-task-grid button:not(.outside)",
    ),
  ][10];
  await act(async () => day.click());
  const select = [...host.querySelectorAll<HTMLSelectElement>("select")].find(
    (s) => [...s.options].some((o) => o.value === "10"),
  )!;
  await act(async () => {
    select.value = "10";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mocks.createTask).toHaveBeenCalledOnce();
  expect(mocks.createReminder).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("تسک قبلاً ثبت شده است");
  expect(
    parseFollowup(
      localStorage.getItem("khoonemoon:task-reminder-followup:user"),
    )?.id,
  ).toBe(id);
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mocks.createTask).toHaveBeenCalledOnce();
  expect(mocks.createReminder).toHaveBeenCalledTimes(2);
  expect(done).toHaveBeenCalledOnce();
  expect(
    localStorage.getItem("khoonemoon:task-reminder-followup:user"),
  ).toBeNull();
  await act(async () => root.unmount());
});
it("rejects malformed persisted follow-up data", () => {
  expect(parseFollowup("not json")).toBeNull();
  expect(
    parseFollowup(JSON.stringify({ id: "oops", due: "bad", minutes: 999 })),
  ).toBeNull();
});
