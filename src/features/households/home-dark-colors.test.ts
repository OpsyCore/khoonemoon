// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";

const home = readFileSync("mobile/src/home-dashboard.css", "utf8");
const today = readFileSync("mobile/src/today.css", "utf8");
const mobile = readFileSync("mobile/src/style.css", "utf8");
afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
});
for (const mode of ["android", "web"]) {
  it(`preserves home status and controls in dark mode on ${mode}`, () => {
    if (mode === "android") document.documentElement.dataset.theme = "dark";
    else document.documentElement.classList.add("dark");
    document.body.innerHTML = `<div class="home-ref"><div class="home-ref-status-header"><em>با هم</em></div><div class="home-ref-message">خطا</div><div class="home-ref-manage"><button>ترک خانه</button></div></div>`;
    const style = document.createElement("style");
    style.textContent = mobile + "\n" + home;
    document.head.append(style);
    expect(getComputedStyle(document.querySelector("em")!).color).toBe(
      "rgb(224, 220, 202)",
    );
    expect(
      getComputedStyle(document.querySelector(".home-ref-message")!).color,
    ).toBe("rgb(244, 180, 164)");
    expect(
      getComputedStyle(document.querySelector("button")!).backgroundColor,
    ).toBe("rgba(0, 0, 0, 0)");
  });
}
it("protects today event buttons from the light rule in web dark mode", () => {
  // Equal specificity, later source order: web's class-based dark theme wins.
  expect(today).toMatch(
    /:root\.dark \.today-ref button\.today-ref-item,[\s\S]*?background: #45483c/,
  );
  expect(
    today.indexOf(":root.dark .today-ref button.today-ref-item"),
  ).toBeGreaterThan(
    today.indexOf(
      ':root:not([data-theme="dark"]) .today-ref button.today-ref-item',
    ),
  );
  expect(today).toContain("--today-muted: var(--muted-text)");
  expect(today).toContain("--today-muted: #c4bcaa");
  expect(today).toContain("color: #f4b4a4");
});
