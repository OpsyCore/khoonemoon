import { afterEach, expect, it, vi } from "vitest";
import { probeConnection } from "./connection-probe";
afterEach(() => vi.unstubAllGlobals());
it("only accepts a reachable HTTP response and does not send cookies", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ status: 404 })
    .mockResolvedValueOnce({ status: 503 })
    .mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetch);
  expect(await probeConnection("/api/__connection")).toBe(true);
  expect(fetch.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    cache: "no-store",
  });
  expect(await probeConnection("/api/__connection")).toBe(false);
  expect(await probeConnection("/api/__connection")).toBe(false);
});
