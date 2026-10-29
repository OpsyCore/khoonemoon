import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// BottomNav reads the current path; stub it so the component can be rendered
// outside an app router.
const mockPathname = vi.hoisted(() => ({ value: "/calendar" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
}));

import { BottomNav } from "@/shared/layout/bottom-nav";

describe("<BottomNav />", () => {
  it("renders no badge when nothing is due", () => {
    const html = renderToStaticMarkup(<BottomNav dueReminderCount={0} />);

    expect(html).not.toContain("bg-rose-600");
    expect(html).not.toContain("یادآور رسیده");
  });

  it("shows the count on the today item and spells it out for screen readers", () => {
    const html = renderToStaticMarkup(<BottomNav dueReminderCount={3} />);

    expect(html).toContain("bg-rose-600");
    expect(html).toContain("۳");
    expect(html).toContain("۳ یادآور رسیده");
  });

  it("caps the visual badge but keeps the real number for screen readers", () => {
    const html = renderToStaticMarkup(<BottomNav dueReminderCount={42} />);

    expect(html).toContain("۹+");
    // The hidden label is intentionally exact: hiding the true count from a
    // screen-reader user would be a downgrade, not a simplification.
    expect(html).toContain("۴۲ یادآور رسیده");
  });

  it("marks the active route", () => {
    const html = renderToStaticMarkup(<BottomNav dueReminderCount={0} />);

    // The mocked pathname is /calendar.
    expect(html).toContain('aria-current="page"');
  });
});
