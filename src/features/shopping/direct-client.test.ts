import { AuthError, createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directShopping } from "./direct-client";

function setup(authenticated = true) {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: "row-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient(
    "https://example.supabase.co",
    "public-anon-key",
    {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  vi.spyOn(client.auth, "getUser").mockResolvedValue(
    authenticated
      ? { data: { user: { id: "user-1" } as never }, error: null }
      : { data: { user: null }, error: new AuthError("No session") },
  );
  return { api: directShopping(client), fetcher };
}

describe("direct Supabase shopping transport", () => {
  it("uses the current user, trims input, and targets the current database schema", async () => {
    const { api, fetcher } = setup();
    await api.createList("house-1", {
      name: "  خرید خانه  ",
      created_by: "forged",
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("shopping_lists");
    expect(JSON.parse(String(init?.body))).toEqual({
      household_id: "house-1",
      name: "خرید خانه",
      created_by: "user-1",
    });
    expect(String(url)).toContain("archived_at");
    expect(String(url)).not.toContain("is_active");
  });

  it("sets purchase attribution from authenticated user and clears it when unchecked", async () => {
    const { api, fetcher } = setup();
    await api.updateItem("item-1", { purchased: true, purchased_by: "forged" });
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(first).toMatchObject({ purchased: true, purchased_by: "user-1" });
    expect(Number.isNaN(Date.parse(first.purchased_at))).toBe(false);
    await api.updateItem("item-1", { purchased: false });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      purchased: false,
      purchased_by: null,
      purchased_at: null,
    });
  });

  it("rejects missing authentication and invalid inputs before making a database request", async () => {
    const { api, fetcher } = setup(false);
    await expect(api.createList("house-1", { name: "خرید" })).rejects.toThrow(
      "وارد حساب",
    );
    await expect(
      api.addItem({ listId: "not-a-uuid", name: "" }),
    ).rejects.toThrow();
    await expect(api.updateItem("item-1", {})).rejects.toThrow(
      "تغییری ارسال نشد",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports RLS and network failures without displaying raw database errors", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "sensitive detail" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.createList("house-1", { name: "خرید" })).rejects.toThrow(
      "ایجاد لیست خرید ناموفق بود",
    );
  });
});
