import { AuthError, createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directReminders } from "./direct-client";
const targetId = "00000000-0000-4000-8000-000000000001";
function setup(auth = true) {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify(
          String(url).includes("/tasks")
            ? { id: targetId, household_id: null }
            : null,
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue(
    auth
      ? { data: { user: { id: "me" } as never }, error: null }
      : { data: { user: null }, error: new AuthError("missing") },
  );
  return { api: directReminders(client), fetcher };
}
describe("direct reminders", () => {
  it("derives ownership and target household from RLS-protected data", async () => {
    const { api, fetcher } = setup();
    await api.create({
      targetType: "TASK",
      targetId,
      baseDateTime: "2026-12-01T12:00:00.000Z",
      offsets: [{ minutesBefore: 30 }],
      householdId: targetId,
      user_id: "forged",
    });
    const payload = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(payload[0]).toMatchObject({
      user_id: "me",
      household_id: null,
      remind_at: "2026-12-01T11:30:00.000Z",
    });
  });
  it("blocks invalid targets and missing auth", async () => {
    const { api, fetcher } = setup(false);
    await expect(
      api.create({
        targetType: "TASK",
        targetId,
        baseDateTime: "2026-12-01T12:00:00.000Z",
        offsets: [{ minutesBefore: 0 }],
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports inaccessible target", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      api.create({
        targetType: "TASK",
        targetId,
        baseDateTime: "2026-12-01T12:00:00.000Z",
        offsets: [{ minutesBefore: 0 }],
      }),
    ).rejects.toThrow("دسترسی");
  });
  it("saves notification preferences for the authenticated account", async () => {
    const { api, fetcher } = setup();
    await api.savePreferences({
      inAppEnabled: true,
      webPushEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      user_id: "forged",
    });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      user_id: "me",
      in_app_enabled: true,
      web_push_enabled: false,
      quiet_hours_start: "22:00",
    });
  });
  it("rejects invalid quiet hours before database writes", async () => {
    const { api, fetcher } = setup();
    await expect(
      api.savePreferences({
        inAppEnabled: true,
        webPushEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: "24:00",
        quietHoursEnd: "08:00",
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
