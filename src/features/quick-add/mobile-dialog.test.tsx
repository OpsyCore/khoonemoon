// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickAdd } from "../../../mobile/src/quick-add";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
afterEach(() => {
  document.body.innerHTML = "";
});
describe("quick add modal", () => {
  it("opens a labeled modal, focuses the first control and restores focus after Escape", async () => {
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    await act(async () => {
      root.render(
        <QuickAdd
          client={{} as SupabaseClient}
          householdId={null}
          onDone={vi.fn()}
        />,
      );
    });
    const trigger = node.querySelector("button")!;
    await act(async () => {
      trigger.click();
    });
    const dialog = node.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBe("quick-add-heading");
    expect(document.activeElement).toBe(dialog.querySelector("select"));
    await act(async () => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(node.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => {
      root.unmount();
    });
  });
  it("opens the full task form instead of a second abbreviated create path", async () => {
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    const openTask = vi.fn();
    await act(async () =>
      root.render(
        <QuickAdd
          client={{} as SupabaseClient}
          householdId={null}
          onDone={vi.fn()}
          onNewTask={openTask}
        />,
      ),
    );
    await act(async () =>
      node.querySelector<HTMLButtonElement>("button")!.click(),
    );
    const form = [
      ...node.querySelectorAll<HTMLButtonElement>("dialog button"),
    ].find((b) => b.textContent?.includes("تسک جدید"))!;
    expect(form).toBeTruthy();
    await act(async () => form.click());
    expect(openTask).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
