import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/shared/ui/design-tokens.css", "utf8");
const web = readFileSync("src/app/globals.css", "utf8");
const mobile = readFileSync("mobile/src/style.css", "utf8");
describe("shared web and Android design foundation", () => {
  it("imports one token source and retains the required light palette", () => {
    expect(web).toContain("../shared/ui/design-tokens.css");
    expect(mobile).toContain("../../src/shared/ui/design-tokens.css");
    for (const [name, value] of Object.entries({
      paper: "#f5f2eb",
      card: "#f9f6f0",
      sunken: "#f8f6ef",
      olive: "#69704d",
      clay: "#cca286",
      ink: "#302e25",
      muted: "#aca99c",
      "muted-text": "#655f57",
      cream: "#fffdf7",
    })) {
      expect(tokens).toContain(`--${name}: ${value}`);
    }
  });
  it("uses the shared palette for the main light screen surfaces", () => {
    const rules = {
      "today.css": ["--today-paper: var(--card)", "--today-ink: var(--ink)"],
      "home-dashboard.css": [
        "--home-paper: var(--card)",
        "--home-ink: var(--ink)",
      ],
      "shopping.css": ["--shop-paper: var(--card)", "--shop-ink: var(--ink)"],
      "finance-overview.css": [
        "--fin-paper: var(--card)",
        "--fin-ink: var(--ink)",
      ],
      "documents.css": ["--doc-paper: var(--card)", "--doc-ink: var(--ink)"],
      "settings.css": ["--st-card: var(--card)", "--st-text: var(--ink)"],
      "chores-dashboard.css": [
        "--chore-paper: var(--card)",
        "--chore-ink: var(--ink)",
      ],
      "new-task.css": ["--nt-paper: var(--card)", "--nt-ink: var(--ink)"],
    };
    for (const [file, expected] of Object.entries(rules)) {
      const css = readFileSync(`mobile/src/${file}`, "utf8");
      for (const rule of expected) expect(css).toContain(rule);
    }
    expect(mobile).toContain("--cal-paper:var(--card)");
    expect(mobile).toContain("--cal-ink:var(--ink)");
  });
  it("uses shared light and dark tokens for remaining screens and auth", () => {
    const search = readFileSync("mobile/src/search.css", "utf8");
    const reminders = readFileSync("mobile/src/reminders.css", "utf8");
    const event = readFileSync("mobile/src/new-event.css", "utf8");
    for (const css of [search, reminders, event]) {
      expect(css).toContain("var(--card)");
      expect(css).toContain("var(--ink)");
      expect(css).toContain(':root[data-theme="dark"]');
      expect(css).toContain(".dark ");
    }
    const login = readFileSync(
      "src/features/auth/components/login-art.css",
      "utf8",
    );
    const recovery = readFileSync(
      "src/features/auth/components/recovery-reference.css",
      "utf8",
    );
    const offline = readFileSync("public/offline-screen.css", "utf8");
    expect(login).toContain("--login-paper:var(--paper)");
    expect(recovery).toContain("background: var(--paper)");
    expect(offline).toContain("background: var(--paper, #f5f2eb)");
  });
  it("keeps reference muted as a swatch but uses a readable text color", () => {
    function luminance(hex: string) {
      const rgb = hex.match(/\w\w/g)!.map((part) => parseInt(part, 16) / 255);
      return rgb
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    }
    const text = luminance("655f57");
    for (const surface of ["f5f2eb", "f9f6f0"]) {
      expect(
        (luminance(surface) + 0.05) / (text + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(web).toContain("--color-muted: var(--muted-text)");
  });
  it("applies the same dark tokens to web class and Android data-theme", () => {
    expect(tokens).toMatch(/\.dark,\s*:root\[data-theme="dark"\]\s*\{/);
    expect(tokens).toContain("--paper: #262119");
    expect(tokens).toContain("--ink: #ede4d1");
    expect(mobile).not.toMatch(/--paper:\s*#/);
    expect(mobile).not.toMatch(/--olive:\s*#/);
  });
});
