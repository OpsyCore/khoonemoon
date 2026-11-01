import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ThemeSettings } from "../../../mobile/src/theme-settings";

describe("standalone foundation", () => {
  it("exposes all theme choices and reports failed persistence accessibly", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeSettings, {
        mode: "dark",
        setMode: () => {},
        persisted: false,
      }),
    );
    expect(html).toContain('value="light"');
    expect(html).toContain('value="dark" selected=""');
    expect(html).toContain('value="system"');
    expect(html).toContain('role="status"');
  });
  it("uses semantic category buttons and the compact botanical illustration", () => {
    const documents = readFileSync("mobile/src/documents.tsx", "utf8");
    const css = readFileSync("mobile/src/style.css", "utf8");
    expect(documents).toContain('role="group" aria-label="دسته مدارک"');
    expect(documents).toContain("aria-pressed={category === key}");
    expect(css).toContain("botanical.webp");
    expect(readFileSync("mobile/public/botanical.webp").length).toBeLessThan(
      100_000,
    );
  });
  it("makes the static shell offline limitation explicit", () => {
    const app = readFileSync("mobile/src/main.tsx", "utf8");
    expect(app).toContain('window.addEventListener("offline", update)');
    expect(app).toContain('window.addEventListener("online", update)');
    expect(app).toContain('className="network-status" role="status"');
  });
});
