import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directCalendar } from "./direct-client";

const event = {
  title: "  قرار  ",
  visibility: "PRIVATE",
  startAt: "2026-11-02T10:00:00.000Z",
  endAt: "2026-11-02T11:00:00.000Z",
  allDay: false,
};
function setup() {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify(
          String(url).includes("household_members")
            ? { household_id: "house-1" }
            : { id: "event-1" },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue({
    data: { user: { id: "user-1" } as never },
    error: null,
  });
  return { api: directCalendar(client), fetcher };
}

describe("direct calendar transport", () => {
  it("creates private events for the signed-in user and never trusts supplied ownership", async () => {
    const { api, fetcher } = setup();
    await api.create({ ...event, owner_id: "other", household_id: "other" });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      title: "قرار",
      creator_id: "user-1",
      owner_id: "user-1",
      household_id: null,
    });
  });
  it("gets current membership for shared events", async () => {
    const { api, fetcher } = setup();
    await api.create({ ...event, visibility: "HOUSEHOLD_SHARED" });
    expect(String(fetcher.mock.calls[0][0])).toContain("household_members");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      household_id: "house-1",
      visibility: "HOUSEHOLD_SHARED",
    });
  });
  it("rejects invalid time ranges before issuing any requests", async () => {
    const { api, fetcher } = setup();
    await expect(
      api.create({ ...event, endAt: event.startAt }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports missing membership and does not issue an insert", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      api.create({ ...event, visibility: "HOUSEHOLD_SHARED" }),
    ).rejects.toThrow("عضو خانه");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
