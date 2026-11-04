import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceChart } from "../../../mobile/src/finance-chart";
describe("standalone finance chart", () => {
  it("renders scaled, labeled income and expense for the selected currency", () => {
    const html = renderToStaticMarkup(
      <FinanceChart
        currency="USD"
        analytics={{
          hasData: true,
          peak: 100,
          categories: [],
          months: [
            { key: "1405-01", label: "فروردین", income: 100, expense: 50 },
          ],
        }}
      />,
    );
    expect(html).toContain('height="90"');
    expect(html).toContain('height="45"');
    expect(html).toContain("فروردین");
    expect(html).toContain("USD");
  });
});
