// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";

const mobile = readFileSync("mobile/src/style.css", "utf8");
const chore = readFileSync("mobile/src/chores-dashboard.css", "utf8");
afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
});
for (const mode of ["light", "android-dark", "web-dark"]) {
  it(`keeps chore controls distinct and readable in ${mode}`, () => {
    if (mode === "android-dark")
      document.documentElement.dataset.theme = "dark";
    if (mode === "web-dark") document.documentElement.classList.add("dark");
    document.body.innerHTML = `<div class="chore-ref">
      <div class="chore-ref-header"><button></button></div>
      <div class="chore-ref-tabs"><button aria-pressed="true"></button><button aria-pressed="false"></button></div>
      <div class="chore-ref-row"><button>انجام شد</button></div>
      <div class="chore-ref-heading"><button>مشاهده همه</button></div>
      <button class="chore-ref-add"></button><div class="chore-ref-summary"><p>متن</p></div>
    </div>`;
    const style = document.createElement("style");
    style.textContent = mobile + "\n" + chore;
    document.head.append(style);
    for (const selector of [
      ".chore-ref-header button",
      '.chore-ref-tabs button[aria-pressed="false"]',
      ".chore-ref-row button",
      ".chore-ref-heading button",
    ]) {
      expect(
        getComputedStyle(document.querySelector(selector)!).backgroundColor,
        selector,
      ).toBe("rgba(0, 0, 0, 0)");
    }
    expect(
      getComputedStyle(
        document.querySelector('.chore-ref-tabs button[aria-pressed="true"]')!,
      ).backgroundColor,
    ).toBe("rgb(102, 115, 78)");
    expect(
      getComputedStyle(document.querySelector(".chore-ref-add")!)
        .backgroundColor,
    ).toBe("rgb(102, 115, 78)");
    if (mode !== "light") {
      expect(
        getComputedStyle(document.querySelector(".chore-ref-row button")!)
          .color,
      ).toBe("rgb(240, 184, 158)");
      expect(
        getComputedStyle(document.querySelector(".chore-ref-summary p")!).color,
      ).toBe("rgb(212, 213, 197)");
    }
  });
}
it("uses selectors stronger than the native global button fill regardless of import order", () => {
  for (const selector of [
    ".chore-ref-header button",
    ".chore-ref-tabs button",
    ".chore-ref-row > button",
    ".chore-ref-heading button",
    "button.chore-ref-add",
  ]) {
    expect(chore).toContain(`:root .chore-ref ${selector}:not(.calendar-day)`);
  }
});
