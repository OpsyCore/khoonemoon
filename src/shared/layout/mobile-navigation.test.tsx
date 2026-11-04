// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "../../../mobile/src/navigation";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
describe("mobile navigation", () => {
  it("keeps five fixed destinations and opens the remaining pages in a dismissible menu", async () => {
    const show = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: show,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    });
    const div = document.createElement("div");
    document.body.append(div);
    const root = createRoot(div),
      navigate = vi.fn();
    await act(async () =>
      root.render(
        <MobileNavigation page="tasks" dueCount={3} onNavigate={navigate} />,
      ),
    );
    const bottom = div.querySelector('nav[aria-label="بخش‌های اصلی برنامه"]')!;
    expect(bottom.querySelectorAll("button")).toHaveLength(5);
    expect(
      [...bottom.querySelectorAll("button")].map(
        (button) => button.textContent,
      ),
    ).toEqual(["خانه", "امروز", "تقویم", "لیست‌ها", "مالی"]);
    expect(
      bottom.querySelector('button[aria-current="page"]')?.textContent,
    ).toBe("امروز");
    expect(bottom.textContent).toContain("امروز");
    expect(bottom.textContent).not.toContain("مدارک");
    const trigger = div.querySelector(
      'button[aria-haspopup="dialog"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute("aria-label")).toContain("۳ یادآور رسیده");
    await act(async () => trigger.click());
    expect(show).toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = div.querySelector('nav[aria-label="بخش‌های دیگر برنامه"]')!;
    expect(menu.textContent).toContain("مدارک");
    const docs = [...menu.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("مدارک"),
    )!;
    await act(async () => docs.click());
    expect(navigate).toHaveBeenCalledWith("documents");
    expect(close).toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await act(async () => root.unmount());
  });
});
