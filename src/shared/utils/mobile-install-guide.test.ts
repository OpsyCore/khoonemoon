import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { InstallGuide } from "../../../mobile/src/install-guide";

afterEach(() => vi.unstubAllGlobals());
describe("standalone install guidance", () => {
  const state = {
    available: true,
    installed: false,
    message: "",
    install: async () => {},
  };
  it("offers browser installation and explains offline limitations", () => {
    vi.stubGlobal("window", {});
    const html = renderToStaticMarkup(createElement(InstallGuide, { state }));
    expect(html).toContain("نصب وب‌اپ");
    expect(html).toContain("داده‌های خصوصی");
    expect(html).toContain("به اینترنت نیاز دارند");
  });
  it("does not offer PWA installation inside the Android app", () => {
    vi.stubGlobal("window", { KhoonemoonNotifications: {} });
    const html = renderToStaticMarkup(createElement(InstallGuide, { state }));
    expect(html).not.toContain("<button");
    expect(html).toContain("مستقل روی اندروید نصب شده است");
  });
});
