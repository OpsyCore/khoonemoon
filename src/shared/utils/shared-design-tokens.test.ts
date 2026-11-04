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
      paper: "#f5ebdd",
      card: "#e9ddc8",
      sunken: "#f1e6d6",
      olive: "#85875d",
      clay: "#c98268",
      ink: "#49382b",
      muted: "#8b7c6b",
      cream: "#fbf7ec",
    })) {
      expect(tokens).toContain(`--${name}: ${value}`);
    }
  });
  it("applies the same dark tokens to web class and Android data-theme", () => {
    expect(tokens).toMatch(/\.dark,\s*:root\[data-theme="dark"\]\s*\{/);
    expect(tokens).toContain("--paper: #262119");
    expect(tokens).toContain("--ink: #ede4d1");
    expect(mobile).not.toMatch(/--paper:\s*#/);
    expect(mobile).not.toMatch(/--olive:\s*#/);
  });
});
