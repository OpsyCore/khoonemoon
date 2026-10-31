import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directTasks } from "./direct-client";
import type { TaskRecord } from "./types";

function setup() {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: "task-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { api: directTasks(client), fetcher };
}

describe("direct task transport", () => {
  it("writes completion and guards against a stale task status", async () => {
    const { api, fetcher } = setup();
    await api.completion(
      { id: "task-1", status: "PENDING" } as TaskRecord,
      "complete",
    );
    expect(String(fetcher.mock.calls[0][0])).toContain("status=eq.PENDING");
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.status).toBe("COMPLETED");
    expect(Number.isNaN(Date.parse(body.completed_at))).toBe(false);
  });
  it("reports a conflicting or inaccessible row rather than false success", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      api.completion(
        { id: "task-1", status: "COMPLETED" } as TaskRecord,
        "undo",
      ),
    ).rejects.toThrow();
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      status: "PENDING",
      completed_at: null,
    });
  });
});

describe("task edits and archive", () => {
  it("validates title before making requests and writes a trimmed title", async () => {
    const { api, fetcher } = setup();
    await expect(api.rename("task-1", " ")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await api.rename("task-1", "  کار جدید  ");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      title: "کار جدید",
    });
  });
  it("archives without claiming success for inaccessible rows", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.archive("task-1")).rejects.toThrow("بایگانی");
  });
});

describe("atomic task creation", () => {
  it("validates and sends the task to the transactional RPC", async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify("task-1"), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await api.create({
      title: "  خرید  ",
      visibility: "PRIVATE",
      priority: "NORMAL",
      status: "PENDING",
      assigneeIds: [],
      recurrence: { frequency: "NONE" },
    });
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "rpc/mobile_create_task",
    );
    expect(
      JSON.parse(String(fetcher.mock.calls[0][1]?.body)).p_input,
    ).toMatchObject({ title: "خرید", assigneeIds: [], nextOccurrenceAt: null });
  });
});
