// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

const css = readFileSync("mobile/src/style.css", "utf8");

describe("calendar styling", () => {
  for (const theme of ["light", "dark"]) {
    it(`keeps calendar controls distinct from the global button fill in ${theme} mode`, () => {
      document.documentElement.dataset.theme = theme;
      document.head.innerHTML = "";
      document.body.innerHTML = `<div class="calendar-page"><button class="calendar-cell"></button><button class="calendar-house-button"></button><div class="calendar-views"><button aria-pressed="true"></button><button aria-pressed="false"></button></div><button class="calendar-refresh"></button></div>`;
      const sheet = document.createElement("style");
      sheet.textContent = css;
      document.head.append(sheet);
      const color = (selector: string) =>
        getComputedStyle(document.querySelector(selector)!).backgroundColor;
      expect(color(".calendar-cell")).toBe("rgba(0, 0, 0, 0)");
      expect(color(".calendar-house-button")).toBe("rgba(0, 0, 0, 0)");
      expect(color('.calendar-views button[aria-pressed="false"]')).toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect(color('.calendar-views button[aria-pressed="true"]')).toBe(
        "rgb(110, 123, 92)",
      );
      expect(color(".calendar-refresh")).toBe("rgba(0, 0, 0, 0)");
    });
  }
  it("uses a genuinely transparent botanical image on mobile and web", async () => {
    for (const path of [
      "mobile/src/assets/calendar-botanical-transparent.webp",
      "public/calendar-botanical-transparent.webp",
    ]) {
      const { data, info } = await sharp(path)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.channels).toBe(4);
      expect(data[3]).toBe(0);
      expect(data[(info.width - 1) * 4 + 3]).toBe(0);
      expect(data[info.width * (info.height - 1) * 4 + 3]).toBe(0);
    }
  });
});
