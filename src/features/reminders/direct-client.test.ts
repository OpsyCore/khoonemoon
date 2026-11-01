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
  it.each([
    ["CHORE", "chores"],
    ["BILL", "financial_records"],
  ] as const)(
    "creates %s reminders using RLS-scoped targets",
    async (type, table) => {
      const { api, fetcher } = setup();
      fetcher.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: targetId, household_id: null }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await api.create({
        targetType: type,
        targetId,
        baseDateTime: "2026-12-01T12:00:00.000Z",
        offsets: [{ minutesBefore: 0 }],
      });
      expect(String(fetcher.mock.calls[0][0])).toContain(`/rest/v1/${table}`);
      expect(
        JSON.parse(String(fetcher.mock.calls[1][1]?.body))[0],
      ).toMatchObject({
        target_type: type,
        target_id: targetId,
        user_id: "me",
        household_id: null,
      });
    },
  );
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
  it("cancels only an unchanged active reminder while keeping its history", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "reminder-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await api.cancel("reminder-1", "2026-10-01T00:00:00.000Z");
    const url = decodeURIComponent(String(fetcher.mock.calls[0][0]));
    expect(url).toContain("updated_at=eq.2026-10-01T00:00:00.000Z");
    expect(url).toContain("status=in.(PENDING,SNOOZED)");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      status: "CANCELED",
    });
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

describe("reminder retry after a lost response", () => {
  it("reuses all generated IDs until every committed row can be confirmed", async () => {
    const { api, fetcher } = setup();
    const ids: string[][] = [];
    fetcher.mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.includes("/tasks"))
        return new Response(
          JSON.stringify({ id: targetId, household_id: null }),
          { status: 200 },
        );
      if (init?.method === "POST") {
        ids.push(
          JSON.parse(String(init.body)).map((row: { id: string }) => row.id),
        );
        return new Response(JSON.stringify({ message: "network" }), {
          status: 503,
        });
      }
      return new Response(
        JSON.stringify(ids.length > 1 ? ids[0].map((id) => ({ id })) : []),
        { status: 200 },
      );
    });
    const input = {
      targetType: "TASK",
      targetId,
      baseDateTime: "2027-01-01T12:00:00.000Z",
      offsets: [{ minutesBefore: 0 }, { minutesBefore: 30 }],
    };
    await expect(api.create(input)).rejects.toThrow("مشخص نیست");
    await expect(api.create(input)).resolves.toBeUndefined();
    expect(ids[1]).toEqual(ids[0]);
    expect(new Set(ids[0]).size).toBe(2);
  });
});
