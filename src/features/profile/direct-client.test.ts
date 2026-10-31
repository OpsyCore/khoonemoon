import { createClient, AuthError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directProfile } from "./direct-client";

function setup(authenticated = true) {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: "user-1", full_name: "نام" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue(
    authenticated
      ? { data: { user: { id: "user-1" } as never }, error: null }
      : { data: { user: null }, error: new AuthError("no session") },
  );
  return { api: directProfile(client), fetcher };
}
describe("direct profile transport", () => {
  it("loads only the current user's profile", async () => {
    const { api, fetcher } = setup();
    await api.get();
    expect(String(fetcher.mock.calls[0][0])).toContain("id=eq.user-1");
  });
  it("ignores forged IDs and validates fields", async () => {
    const { api, fetcher } = setup();
    await api.update({
      id: "other",
      full_name: "  نام کاربر  ",
      timezone: "Asia/Tehran",
      locale: "fa",
    });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      id: "user-1",
      full_name: "نام کاربر",
      timezone: "Asia/Tehran",
      locale: "fa",
    });
    await expect(
      api.update({ full_name: "", timezone: "", locale: "" }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects profile access without an authenticated user", async () => {
    const { api, fetcher } = setup(false);
    await expect(api.get()).rejects.toThrow("وارد حساب");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
