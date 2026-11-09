import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps the reference sections side by side and table columns constrained on small screens", () => {
  const css = readFileSync("mobile/src/bills.css", "utf8");
  const finalSmallScreen = css.slice(
    css.lastIndexOf("@media (max-width: 520px)"),
  );
  expect(finalSmallScreen).toMatch(
    /\.bills-bottom\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(0,\s*0\.95fr\)/,
  );
  expect(finalSmallScreen).toContain(".bill-row");
  expect(css).toContain(".bill-history-row");
  expect(css).toContain("bills-kraft-label.webp");
});
