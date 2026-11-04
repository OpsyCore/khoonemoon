// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const mobileCss = readFileSync("mobile/src/style.css", "utf8");
const homeCss = readFileSync("mobile/src/home-dashboard.css", "utf8");

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete document.documentElement.dataset.theme;
});

describe("home dashboard button palette", () => {
  for (const theme of ["light", "dark"]) {
    it(`keeps non-primary controls clear in ${theme} mode`, () => {
      document.documentElement.dataset.theme = theme;
      document.body.innerHTML = `<div class="home-ref">
        <div class="home-ref-heading"><button></button></div>
        <button class="home-ref-refresh"></button>
        <div class="home-ref-stats"><button></button><div></div></div>
        <div class="home-ref-code"><button></button></div>
        <div class="home-ref-manage"><button></button></div>
        <div class="home-ref-entry-form"><button></button></div>
        <button class="home-ref-primary"></button>
      </div>`;
      const style = document.createElement("style");
      style.textContent = mobileCss + "\n" + homeCss;
      document.head.append(style);
      for (const selector of [
        ".home-ref-heading button",
        ".home-ref-refresh",
        ".home-ref-stats button",
        ".home-ref-code button",
        ".home-ref-manage button",
        ".home-ref-entry-form button",
      ]) {
        expect(
          getComputedStyle(document.querySelector(selector)!).backgroundColor,
          selector,
        ).toBe("rgba(0, 0, 0, 0)");
      }
      expect(
        getComputedStyle(document.querySelector(".home-ref-primary")!)
          .backgroundColor,
      ).toBe("rgb(96, 113, 78)");
    });
  }
  it("overrides the native global button rule regardless of stylesheet order", () => {
    // Each targeted selector has at least four class/pseudo-class components,
    // more than the light global rule's three, including :not(.calendar-day).
    for (const selector of [
      ".home-ref-heading button",
      "button.home-ref-refresh",
      ".home-ref-stats > button",
      ".home-ref-code button",
      ".home-ref-manage button",
      ".home-ref-entry-form button",
      ".home-ref-entry button",
      "button.home-ref-primary",
    ]) {
      expect(homeCss).toContain(
        `:root .home-ref ${selector}:not(.calendar-day)`,
      );
    }
  });
});
