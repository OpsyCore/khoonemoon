// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  handleNativeBack,
  useNativeBack,
} from "../../../mobile/src/native-back";
import type { MobilePage } from "../../../mobile/src/navigation";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
it("gives modal cancel handlers priority and respects prevented cancellation", () => {
  const dialog = document.createElement("dialog");
  dialog.open = true;
  const close = vi.fn();
  dialog.close = close;
  dialog.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(dialog);
  const navigate = vi.fn();
  expect(
    handleNativeBack({
      page: "settings",
      history: ["house"],
      navigate,
      dirty: false,
    }),
  ).toBe(true);
  expect(close).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});
it("leaves the activity at the root and confirms before losing edited form data", () => {
  const navigate = vi.fn();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  expect(
    handleNativeBack({ page: "tasks", history: [], navigate, dirty: false }),
  ).toBe(false);
  const history: MobilePage[] = ["tasks"];
  expect(
    handleNativeBack({ page: "profile", history, navigate, dirty: true }),
  ).toBe(true);
  expect(confirm).toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(history).toEqual(["tasks"]);
  confirm.mockReturnValue(true);
  handleNativeBack({ page: "profile", history, navigate, dirty: true });
  expect(navigate).toHaveBeenCalledWith("tasks");
});
it("uses the form's own back action for reminder follow-up safeguards", () => {
  document.body.innerHTML =
    '<section class="new-task"><header><button aria-label="بازگشت"></button></header></section>';
  const button = document.querySelector("button")!;
  const click = vi.fn();
  button.addEventListener("click", click);
  expect(
    handleNativeBack({
      page: "event-new",
      history: ["calendar"],
      navigate: vi.fn(),
      dirty: false,
    }),
  ).toBe(true);
  expect(click).toHaveBeenCalledOnce();
});
it("tracks in-app page changes without a browser navigation", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let setPage: (page: MobilePage) => void = () => {};
  function Test() {
    const [page, set] = React.useState<MobilePage>("tasks");
    setPage = set;
    useNativeBack(page, true, set);
    return <div>{page}</div>;
  }
  await act(async () => root.render(<Test />));
  await act(async () => setPage("house"));
  await act(async () => setPage("settings"));
  let allowed = true;
  await act(async () => {
    allowed = window.dispatchEvent(
      new Event("khoonemoon:native-back", { cancelable: true }),
    );
  });
  expect(allowed).toBe(false);
  expect(host.textContent).toBe("house");
  await act(async () => root.unmount());
});

it("returns to the previous page while a lazy form is still loading", () => {
  const navigate = vi.fn();
  expect(
    handleNativeBack({
      page: "event-new",
      history: ["calendar"],
      navigate,
      dirty: false,
    }),
  ).toBe(true);
  expect(navigate).toHaveBeenCalledWith("calendar");
});
