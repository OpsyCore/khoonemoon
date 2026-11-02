// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import {
  eventTimes,
  NewEvent,
  parseEventFollowup,
} from "../../../mobile/src/new-event";
const mocks = vi.hoisted(() => ({ create: vi.fn(), reminder: vi.fn() }));
vi.mock("@/features/calendar/direct-client", () => ({
  directCalendar: () => ({ create: mocks.create }),
}));
vi.mock("@/features/reminders/direct-client", () => ({
  directReminders: () => ({ createEventReminderOnce: mocks.reminder }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const id = "00000000-0000-4000-8000-000000000001";
it("persists the follow-up before acknowledging creation and retries only the reminder", async () => {
  mocks.create.mockImplementation(async (_input, confirmed) => {
    confirmed({ id });
    expect(
      parseEventFollowup(
        localStorage.getItem("khoonemoon:event-reminder-followup:user"),
      )?.id,
    ).toBe(id);
    return { id };
  });
  mocks.reminder
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(undefined);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    done = vi.fn();
  await act(async () =>
    root.render(
      <NewEvent
        client={{} as SupabaseClient}
        userId="user"
        householdId={null}
        initialDate={new Date("2099-04-05T12:00:00")}
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
    setter.call(title, "رویداد تازه");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const select = host.querySelector("select")!;
  await act(async () => {
    select.value = "15";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const submit = () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await act(async () => {
    submit();
  });
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.reminder).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("رویداد قبلاً ثبت شده است");
  await act(async () => {
    submit();
  });
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.reminder).toHaveBeenCalledTimes(2);
  expect(done).toHaveBeenCalledOnce();
  expect(
    localStorage.getItem("khoonemoon:event-reminder-followup:user"),
  ).toBeNull();
  await act(async () => root.unmount());
});
it("uses local exclusive all-day end and rejects reversed or invalid ranges", () => {
  const result = eventTimes("2099-04-05", "2099-04-06", "09:00", "10:00", true);
  expect(new Date(result.startAt).getDate()).toBe(5);
  expect(new Date(result.endAt).getDate()).toBe(7);
  expect(() =>
    eventTimes("2099-04-06", "2099-04-05", "09:00", "10:00", true),
  ).toThrow();
  expect(() =>
    eventTimes("2099-04-05", "2099-04-05", "10:00", "09:00", false),
  ).toThrow();
  expect(parseEventFollowup('{"id":"bad"}')).toBeNull();
});
