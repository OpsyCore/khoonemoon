import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Assistant } from "../../../mobile/src/assistant";

describe("shared web and Android assistant surface", () => {
  it("renders in Persian RTL and keeps Cloud opt-in off by default", () => {
    const html = renderToStaticMarkup(
      <Assistant client={{} as SupabaseClient} />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("دستیار هوشمند خونمون");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('type="checkbox" checked=""');
    expect(html).toContain(
      "پاسخ‌ها بر پایهٔ اطلاعاتی است که به آن دسترسی داری",
    );
  });
});
