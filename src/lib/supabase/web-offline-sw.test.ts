import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
it("precaches the public offline artwork and never caches API or cross-origin requests", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = { addAll: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue("offline-page"),
  };
  const self = {
    location: { origin: "https://example.test" },
    addEventListener: (name: string, cb: (event: any) => void) => {
      handlers[name] = cb;
    },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    caches,
    URL,
    fetch: vi.fn().mockRejectedValue(new Error("offline")),
    Response,
  });
  let install: Promise<unknown> | undefined;
  handlers.install({
    waitUntil: (p: Promise<unknown>) => {
      install = p;
    },
  });
  await install;
  expect(cache.addAll).toHaveBeenCalledWith(
    expect.arrayContaining([
      "/offline",
      "/offline-screen.css",
      "/offline-art/house.webp",
      "/offline-art/branch.webp",
    ]),
  );
  const respondWith = vi.fn();
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://example.test/api/__connection",
      mode: "cors",
    },
    respondWith,
  });
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://remote.test/rest/v1/tasks",
      mode: "cors",
    },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://example.test/today",
      mode: "navigate",
    },
    respondWith,
  });
  expect(await respondWith.mock.calls[0][0]).toBe("offline-page");
});
