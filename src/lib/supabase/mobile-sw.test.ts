import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
function worker() {
  const handlers: Record<
    string,
    (event: {
      request: { method: string; url: string; mode: string };
      respondWith: (p: Promise<unknown>) => void;
      waitUntil: (p: Promise<unknown>) => void;
    }) => void
  > = {};
  const self = {
    registration: { scope: "https://example.test/app/" },
    addEventListener: (name: string, fn: (typeof handlers)[string]) => {
      handlers[name] = fn;
    },
    clients: { claim: vi.fn() },
  };
  const fetch = vi.fn().mockRejectedValue(new Error("offline"));
  const cached = {
    match: vi.fn().mockResolvedValue("cached-shell"),
    put: vi.fn(),
    addAll: vi.fn(),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cached),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  };
  vm.runInNewContext(readFileSync("mobile/public/sw.js", "utf8"), {
    self,
    fetch,
    caches,
    URL,
    Request,
  });
  return { handlers, fetch, caches, cached };
}
describe("standalone mobile service worker privacy", () => {
  it("never handles Supabase, API, POST or arbitrary private files", () => {
    const { handlers } = worker();
    const respondWith = vi.fn();
    for (const [method, url] of [
      ["GET", "https://project.supabase.co/rest/v1/tasks"],
      ["GET", "https://example.test/app/api/tasks"],
      ["POST", "https://example.test/app/assets/app.js"],
      ["GET", "https://example.test/app/assets/private.json"],
    ]) {
      handlers.fetch({
        request: { method, url, mode: "cors" },
        respondWith,
        waitUntil: vi.fn(),
      });
    }
    expect(respondWith).not.toHaveBeenCalled();
  });
  it("refreshes only a credential-free static shell after its assets are cached", async () => {
    const { handlers, fetch, cached } = worker();
    const shellResponse = {
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      clone: () => ({
        text: async () =>
          '<script src="./assets/app-abc.js"></script><link href="./assets/app-abc.css">',
      }),
    };
    fetch
      .mockResolvedValueOnce(shellResponse as never)
      .mockResolvedValueOnce("navigation" as never);
    let refresh: Promise<unknown> | undefined;
    handlers.fetch({
      request: {
        method: "GET",
        url: "https://example.test/app/?code=secret",
        mode: "navigate",
      },
      respondWith: () => {},
      waitUntil: (p) => {
        refresh = p;
      },
    });
    await refresh;
    expect(fetch).toHaveBeenCalledWith("https://example.test/app/index.html", {
      cache: "no-store",
      credentials: "omit",
    });
    const requests = cached.addAll.mock.calls[0][0] as Request[];
    expect(requests.map((r) => r.url)).toEqual([
      "https://example.test/app/assets/app-abc.js",
      "https://example.test/app/assets/app-abc.css",
    ]);
    expect(requests.every((r) => r.credentials === "omit")).toBe(true);
    expect(cached.addAll.mock.invocationCallOrder[0]).toBeLessThan(
      cached.put.mock.invocationCallOrder[0],
    );
    expect(cached.put).toHaveBeenCalledWith(
      "https://example.test/app/index.html",
      shellResponse,
    );
  });
  it("falls back to the static shell when a scoped navigation is offline", async () => {
    const { handlers, cached } = worker();
    let result: Promise<unknown> | undefined;
    handlers.fetch({
      request: {
        method: "GET",
        url: "https://example.test/app/?code=secret",
        mode: "navigate",
      },
      respondWith: (p) => {
        result = p;
      },
      waitUntil: vi.fn(),
    });
    expect(await result).toBe("cached-shell");
    expect(cached.match).toHaveBeenCalledWith(
      "https://example.test/app/index.html",
    );
    expect(cached.put).not.toHaveBeenCalled();
  });
});
