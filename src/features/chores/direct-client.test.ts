import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directChores } from "./direct-client";

describe("direct chore transport", () => {
  it("uses the transactional completion RPC and handles failures", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createClient("https://example.supabase.co", "anon", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const api = directChores(client);
    await api.complete("chore-1");
    expect(String(fetcher.mock.calls[0][0])).toContain("rpc/complete_chore");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      p_chore_id: "chore-1",
    });
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "error" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.complete("chore-1")).rejects.toThrow("ناموفق");
  });
});

describe("atomic chore creation", () => {
  it("validates rotating assignees before calling RPC", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify("chore-1"), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createClient("https://example.supabase.co", "anon", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const api = directChores(client);
    await expect(
      api.create({
        title: "کار",
        rotationMode: "ROTATING",
        assigneeIds: [],
        frequency: "WEEKLY",
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await api.create({
      title: "  کار  ",
      rotationMode: "FIXED",
      assigneeIds: [],
      frequency: "WEEKLY",
      weekdays: null,
    });
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "rpc/mobile_create_chore",
    );
    expect(
      JSON.parse(String(fetcher.mock.calls[0][1]?.body)).p_input.title,
    ).toBe("کار");
  });
});
