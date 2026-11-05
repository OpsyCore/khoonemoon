// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LazyScreenBoundary } from "../../../mobile/src/lazy-screen-boundary";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("shows a recovery action instead of a blank screen when loading a screen fails", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const silence = vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken(): never {
    throw new Error("chunk unavailable");
  }
  await act(async () =>
    root.render(
      <LazyScreenBoundary>
        <Broken />
      </LazyScreenBoundary>,
    ),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "بارگذاری صفحه ممکن نشد",
  );
  expect(host.querySelector("button")?.textContent).toContain(
    "بارگذاری دوباره",
  );
  await act(async () => root.unmount());
  silence.mockRestore();
});
