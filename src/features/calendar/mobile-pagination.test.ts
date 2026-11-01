import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { directCalendar } from "./direct-client";
import { directTasks } from "@/features/tasks/direct-client";
import { directChores } from "@/features/chores/direct-client";
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
function setup() {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) => json([]),
  );
  const client = createClient("https://example.supabase.co", "anon", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, fetcher };
}
describe("standalone calendar source pagination", () => {
  for (const [name, list] of [
    ["tasks", (client: SupabaseClient) => directTasks(client).list()],
    ["events", (client: SupabaseClient) => directCalendar(client).list()],
    [
      "chores",
      (client: SupabaseClient) => directChores(client).list("house-1"),
    ],
  ] as const) {
    it(`fetches a second page of ${name} with a stable tie-breaker`, async () => {
      const { client, fetcher } = setup();
      fetcher
        .mockResolvedValueOnce(
          json(Array.from({ length: 500 }, (_, id) => ({ id: String(id) }))),
        )
        .mockResolvedValueOnce(json([{ id: "last" }]));
      expect(await list(client)).toHaveLength(501);
      expect(fetcher).toHaveBeenCalledTimes(2);
      const url = decodeURIComponent(String(fetcher.mock.calls[1][0]));
      expect(url).toContain("offset=500");
      expect(url).toContain("id.");
    });
    it(`does not silently return a partial ${name} list after a page error`, async () => {
      const { client, fetcher } = setup();
      fetcher
        .mockResolvedValueOnce(
          json(Array.from({ length: 500 }, (_, id) => ({ id: String(id) }))),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 500 }));
      await expect(list(client)).rejects.toThrow();
    });
  }
});
