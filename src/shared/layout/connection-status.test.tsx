// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ConnectionStatus } from "./connection-status";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});
it("shows an offline overlay without unmounting drafts and retries via network", async () => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <>
        <input defaultValue="پیش‌نویس" />
        <ConnectionStatus offlineOnly />
      </>,
    ),
  );
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  await act(async () => window.dispatchEvent(new Event("offline")));
  expect(host.textContent).toContain("ارتباط قطع شده");
  expect(host.querySelector("input")?.value).toBe("پیش‌نویس");
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ status: 404 });
  vi.stubGlobal("fetch", fetchMock);
  const button = host.querySelector<HTMLButtonElement>(".offline-retry")!;
  await act(async () => button.click());
  expect(host.textContent).toContain("اتصال به سرور برقرار نشد");
  await act(async () => button.click());
  expect(host.querySelector(".offline-overlay")).toBeNull();
  expect(host.querySelector("input")?.value).toBe("پیش‌نویس");
  expect(String(fetchMock.mock.calls[0][0])).toContain("/api/__connection?");
  await act(async () => root.unmount());
});
