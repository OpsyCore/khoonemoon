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
    registration: {
      scope: "https://example.test/app/",
      showNotification: vi.fn().mockResolvedValue(undefined),
    },
    addEventListener: (name: string, fn: (typeof handlers)[string]) => {
      handlers[name] = fn;
    },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
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
  return { handlers, fetch, caches, cached, self };
}
describe("standalone mobile service worker privacy", () => {
  it("shows generic push and opens only the scoped inbox", async () => {
    const { handlers, self } = worker();
    let work: Promise<unknown> | undefined;
    const waitUntil = (p: Promise<unknown>) => {
      work = p;
    };
    const basic = {
      request: { method: "", url: "", mode: "" },
      respondWith: vi.fn(),
      waitUntil,
    };
    handlers.push(basic);
    await work;
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "خونه‌مون",
      expect.objectContaining({ body: "زمان یک یادآور رسیده است." }),
    );
    const close = vi.fn();
    handlers.notificationclick({
      ...basic,
      notification: { close, data: { url: "https://evil.test/" } },
    } as typeof basic);
    await work;
    expect(close).toHaveBeenCalledOnce();
    expect(self.clients.openWindow).toHaveBeenCalledWith(
      "https://example.test/app/?page=reminders",
    );
  });
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
    cached.match.mockResolvedValueOnce({
      text: async () =>
        `@font-face{src:url("./font.woff2")} body{background:url(./flower.webp)} div{background:url(https://evil.test/assets/file.png)} i{background:url(./private.json)}`,
    } as never);
    fetch
      .mockResolvedValueOnce(shellResponse as never)
      .mockResolvedValueOnce("navigation" as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ["assets/lazy-def.js"],
      } as never);
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
      "https://example.test/app/assets/lazy-def.js",
    ]);
    expect(requests.every((r) => r.credentials === "omit")).toBe(true);
    const dependencies = cached.addAll.mock.calls[1][0] as Request[];
    expect(dependencies.map((r) => r.url)).toEqual([
      "https://example.test/app/assets/font.woff2",
      "https://example.test/app/assets/flower.webp",
    ]);
    expect(dependencies.every((r) => r.credentials === "omit")).toBe(true);
    expect(cached.addAll.mock.invocationCallOrder[0]).toBeLessThan(
      cached.put.mock.invocationCallOrder[0],
    );
    expect(cached.put).toHaveBeenCalledWith(
      "https://example.test/app/index.html",
      shellResponse,
    );
  });
  it("rejects an unsafe lazy-asset manifest without replacing the previous shell", async () => {
    const { handlers, fetch, cached } = worker();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        clone: () => ({
          text: async () => '<script src="./assets/app.js"></script>',
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ["assets/../../private.js"],
      } as never);
    let install: Promise<unknown> | undefined;
    handlers.install({
      request: { method: "", url: "", mode: "" },
      respondWith: vi.fn(),
      waitUntil: (p) => {
        install = p;
      },
    });
    await expect(install).rejects.toThrow("invalid manifest asset");
    expect(cached.put).not.toHaveBeenCalled();
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
  it("does not replace the prior shell when a stylesheet dependency fails", async () => {
    const { handlers, fetch, cached } = worker();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        clone: () => ({
          text: async () =>
            '<script src="./assets/app.js"></script><link href="./assets/app.css">',
        }),
      } as never)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as never);
    cached.match.mockResolvedValueOnce({
      text: async () => "body{background:url(./image.webp)}",
    } as never);
    cached.addAll
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error("offline"));
    let install: Promise<unknown> | undefined;
    handlers.install({
      request: { method: "", url: "", mode: "" },
      respondWith: vi.fn(),
      waitUntil: (p) => {
        install = p;
      },
    });
    await expect(install).rejects.toThrow("offline");
    expect(cached.put).not.toHaveBeenCalled();
  });
});
