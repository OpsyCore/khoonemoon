// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsDashboard } from "../../../mobile/src/settings";
const mock = vi.hoisted(() => ({
  preferences: vi.fn(),
  updateInApp: vi.fn(),
  updateQuietHours: vi.fn(),
}));
vi.mock("@/features/reminders/direct-client", () => ({
  directReminders: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const install = {
  available: false,
  installed: false,
  message: "",
  install: vi.fn(),
};
it("reads real notification state, toggles it and navigates to household", async () => {
  mock.preferences.mockResolvedValue({
    in_app_enabled: true,
    quiet_hours_enabled: false,
  });
  mock.updateInApp.mockResolvedValue(undefined);
  const host = document.createElement("div"),
    house = vi.fn(),
    theme = vi.fn();
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <SettingsDashboard
        client={{} as SupabaseClient}
        theme="system"
        setTheme={theme}
        install={install}
        onHouse={house}
        onAccount={vi.fn()}
      />,
    );
  });
  const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  await act(async () => toggle.click());
  expect(mock.updateInApp).toHaveBeenCalledWith(false);
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('[aria-label="رفتن به مدیریت خانوار"]')!
      .click(),
  );
  expect(house).toHaveBeenCalledOnce();
  const light = [
    ...host.querySelectorAll<HTMLButtonElement>(".settings-ref-themes button"),
  ].find((b) => b.textContent?.includes("روشن"))!;
  await act(async () => light.click());
  expect(theme).toHaveBeenCalledWith("light");
  await act(async () => root.unmount());
});
it("does not display a guessed enabled state when loading preferences fails", async () => {
  mock.preferences.mockRejectedValue(new Error("offline"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <SettingsDashboard
        client={{} as SupabaseClient}
        theme="system"
        setTheme={vi.fn()}
        install={install}
        onHouse={vi.fn()}
        onAccount={vi.fn()}
      />,
    );
  });
  expect(host.querySelector('[role="switch"]')).toBeNull();
  expect(host.textContent).toContain("نامشخص");
  expect(host.textContent).toContain("دریافت دوباره تنظیمات");
  await act(async () => root.unmount());
});
