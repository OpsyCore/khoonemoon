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

describe("guarded completion", () => {
  it("sends the displayed revision and rejects ambiguous failures", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify("completion-1"), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createClient("https://example.supabase.co", "anon", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await directChores(client).completeVersion("chore-1", 4);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "complete_chore_expected_version",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      p_chore_id: "chore-1",
      p_expected_version: 4,
    });
  });
});

describe("pause and resume", () => {
  it("updates only the expected active, unarchived row and rejects stale changes", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "chore-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createClient("https://example.supabase.co", "anon", {
      global: { fetch: fetcher },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const api = directChores(client);
    await api.setActive("chore-1", true);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      is_active: false,
    });
    const url = decodeURIComponent(String(fetcher.mock.calls[0][0]));
    expect(url).toContain("is_active=eq.true");
    expect(url).toContain("archived_at=is.null");
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.setActive("chore-1", true)).rejects.toThrow();
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

describe("atomic chore update", () => {
  it("sends validated assignments and schedule to the update RPC", async () => {
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
    await directChores(client).update(
      "chore-1",
      {
        title: "کار",
        rotationMode: "FIXED",
        assigneeIds: [],
        frequency: "DAILY",
      },
      "America/New_York",
    );
    expect(
      JSON.parse(String(fetcher.mock.calls[0][1]?.body)).p_input
        .recurrenceTimezone,
    ).toBe("America/New_York");
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "rpc/mobile_update_chore",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      p_id: "chore-1",
      p_input: { frequency: "DAILY" },
    });
  });
});
