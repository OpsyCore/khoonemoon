import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReminderInboxView } from "@/features/reminders/components/reminder-inbox-view";
import { buildReminderInbox } from "@/features/reminders/inbox";
import type { ReminderRecord } from "@/features/reminders/types";

function view(reminders: ReminderRecord[]) {
  return (
    <ReminderInboxView
      inbox={buildReminderInbox({
        reminders,
        tasks: TASKS,
        events: EVENTS,
        now: NOW,
      })}
      now={NOW}
      hasReminders={reminders.length > 0}
      onAction={() => {}}
    />
  );
}

const NOW = new Date("2026-10-29T12:00:00.000Z");

const TASKS = [{ id: "t-1", title: "پرداخت قبض" }];
const EVENTS = [{ id: "e-1", title: "جلسهٔ خانواده" }];

function reminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: "r-1",
    target_type: "TASK",
    target_id: "t-1",
    user_id: "u-1",
    household_id: "h-1",
    remind_at: "2026-10-29T09:00:00.000Z",
    status: "PENDING",
    snoozed_until: null,
    snooze_count: 0,
    delivered_at: null,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("<ReminderInbox />", () => {
  it("renders the empty state when there is nothing", () => {
    const html = renderToStaticMarkup(view([]));

    expect(html).toContain("صندوق یادآورها خالی است");
  });

  it("shows counts, resolved titles and the action buttons for due items", () => {
    const html = renderToStaticMarkup(view([reminder()]));

    expect(html).toContain("پرداخت قبض");
    expect(html).toContain("رسیده");
    expect(html).toContain("تعویق ۱۰ دقیقه");
    expect(html).toContain("لغو");
  });

  it("renders a delivered reminder without actions", () => {
    const html = renderToStaticMarkup(
      view([
        reminder({
          status: "SENT",
          delivered_at: "2026-10-27T09:00:00.000Z",
          remind_at: "2026-10-27T09:00:00.000Z",
        }),
      ]),
    );

    expect(html).toContain("تحویل‌شده");
    expect(html).not.toContain("تعویق ۱۰ دقیقه");
  });

  it("flags a repeatedly snoozed reminder", () => {
    const html = renderToStaticMarkup(
      view([
        reminder({
          status: "SNOOZED",
          snooze_count: 3,
          snoozed_until: "2026-10-29T20:00:00.000Z",
        }),
      ]),
    );

    expect(html).toContain("۳ بار تعویق");
    expect(html).toContain("به تعویق افتاده");
  });

  it("labels a deleted target instead of leaving the title blank", () => {
    const html = renderToStaticMarkup(view([reminder({ target_id: "gone" })]));

    expect(html).toContain("تسک حذف‌شده");
  });
});
