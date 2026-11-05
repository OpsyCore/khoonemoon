// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { parse } from "postcss";
import { afterEach, describe, expect, it } from "vitest";

const shell = readFileSync("mobile/src/style.css", "utf8");
const settings = readFileSync("mobile/src/settings.css", "utf8");

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete document.documentElement.dataset.theme;
});

describe("full-width Android page shell", () => {
  for (const mode of ["light", "dark"]) {
    for (const name of [
      "settings-ref",
      "search-ref",
      "reminder-ref",
      "profile-ref",
      "chore-ref",
      "new-task",
    ]) {
      it(`does not frame the ${name} page in ${mode} mode`, () => {
        if (mode === "dark") document.documentElement.dataset.theme = "dark";
        document.body.innerHTML = `<main><section class="${name}"><section class="settings-ref-card">content</section></section></main>`;
        // Limit to relevant top-level rules: jsdom cannot parse all production CSS.
        const root = parse(shell);
        const rules: string[] = [];
        root.walkRules((rule) => {
          if (rule.selector.includes("section") && !rule.parent?.parent)
            rules.push(rule.toString());
        });
        const style = document.createElement("style");
        style.textContent = rules.join("\n");
        document.head.append(style);
        const page = document.querySelector<HTMLElement>(`main > .${name}`)!;
        const resolved = getComputedStyle(page);
        expect(resolved.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(resolved.borderStyle).toBe("none");
        expect(resolved.boxShadow).toBe("none");
        expect(page.querySelector(".settings-ref-card")).not.toBeNull();
      });
    }
  }
  it("uses the paper background without a bright overlay and full-width content", () => {
    expect(shell).toMatch(
      /:root body\s*\{\s*background-color:\s*var\(--paper\);\s*background-image:\s*none;/,
    );
    expect(shell).toMatch(
      /main:not\(\.login-mobile-main\):not\(\.recovery-mobile-main\)\s*\{\s*width:\s*100%;\s*max-width:\s*none;/,
    );
  });
  it("gives unselected theme controls an explicit surface", () => {
    expect(settings).toMatch(
      /button\[aria-pressed="false"\]\s*\{\s*background:\s*var\(--sunken\)/,
    );
    expect(settings).toMatch(
      /button\[aria-pressed="true"\]\s*\{\s*background:\s*var\(--olive-soft\)/,
    );
  });
});
