import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WeeklySummaryCard } from "@/features/summary/components/weekly-summary-card";
import type { WeeklySummary } from "@/features/summary/weekly-summary";

function summary(overrides: Partial<WeeklySummary> = {}): WeeklySummary {
  return {
    tasksDone: 0,
    tasksDonePrevious: 0,
    choresDone: 0,
    choresDonePrevious: 0,
    spent: 0,
    spentPrevious: 0,
    earned: 0,
    spentChange: null,
    ...overrides,
  };
}

describe("<WeeklySummaryCard />", () => {
  it("invites the household to start rather than showing four empty tiles", () => {
    const html = renderToStaticMarkup(
      <WeeklySummaryCard summary={summary()} />,
    );

    expect(html).toContain("این هفته");
    expect(html).toContain("هنوز در هفت روز گذشته چیزی ثبت نشده");
  });

  it("shows the achieved counts in Persian digits", () => {
    const html = renderToStaticMarkup(
      <WeeklySummaryCard
        summary={summary({ tasksDone: 12, tasksDonePrevious: 4 })}
      />,
    );

    expect(html).toContain("۱۲");
    expect(html).toContain("انجام‌شده");
    expect(html).toContain("بیشتر از هفتهٔ قبل");
  });

  it("refuses to claim growth when last week was empty", () => {
    const html = renderToStaticMarkup(
      <WeeklySummaryCard
        summary={summary({ spent: 900_000, spentPrevious: 0 })}
      />,
    );

    expect(html).toContain("هفتهٔ قبل خرجی ثبت نشده بود");
    expect(html).not.toContain("۱۰۰٪");
  });

  it("compares spending against the previous week when there is a baseline", () => {
    const html = renderToStaticMarkup(
      <WeeklySummaryCard
        summary={summary({
          spent: 500_000,
          spentPrevious: 1_000_000,
          spentChange: -50,
        })}
      />,
    );

    expect(html).toContain("کمتر از هفتهٔ قبل");
  });

  it("never prints an unformatted NaN for a broken amount", () => {
    const html = renderToStaticMarkup(
      <WeeklySummaryCard summary={summary({ spent: Number.NaN })} />,
    );

    expect(html).not.toContain("NaN");
  });
});
