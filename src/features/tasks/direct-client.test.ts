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
  it("completes through the idempotent database RPC", async () => {
    const { api, fetcher } = setup();
    await api.completion(
      { id: "task-1", status: "PENDING" } as TaskRecord,
      "complete",
    );
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "rpc/mobile_complete_task",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      p_task_id: "task-1",
    });
  });
  it("does not undo a completed recurring occurrence after creating its successor", async () => {
    const { api, fetcher } = setup();
    await expect(
      api.completion(
        {
          id: "task-1",
          status: "COMPLETED",
          task_recurrences: [{ frequency: "DAILY" }],
        } as TaskRecord,
        "undo",
      ),
    ).rejects.toThrow("تکراری");
    expect(fetcher).not.toHaveBeenCalled();
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

describe("atomic task update", () => {
  it("sends all validated fields to the update RPC and rejects absent rows", async () => {
    const { api, fetcher } = setup();
    const input = {
      title: "تسک",
      visibility: "PRIVATE",
      priority: "HIGH",
      status: "PENDING",
      assigneeIds: [],
      recurrence: { frequency: "NONE" },
    };
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify("task-1"), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await api.update("task-1", input);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "rpc/mobile_update_task",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      p_id: "task-1",
      p_input: { title: "تسک", priority: "HIGH" },
    });
    await expect(api.update("task-1", input)).rejects.toThrow();
  });
});
