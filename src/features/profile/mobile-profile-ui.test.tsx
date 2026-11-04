// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Profile } from "../../../mobile/src/profile";
const mock = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/features/profile/direct-client", () => ({
  directProfile: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
it("shows actual profile information, offers the web destinations and keeps the editable form", async () => {
  mock.get.mockResolvedValue({
    full_name: "سارا",
    timezone: "Asia/Tehran",
    locale: "fa-IR",
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const navigate = vi.fn();
  await act(async () =>
    root.render(
      <Profile
        client={{} as SupabaseClient}
        email="member@example.test"
        onNavigate={navigate}
      />,
    ),
  );
  expect(host.textContent).toContain("سارا");
  expect(host.textContent).toContain("member@example.test");
  expect(host.querySelectorAll(".profile-ref-links button")).toHaveLength(4);
  expect(host.querySelectorAll(".profile-ref-form input")).toHaveLength(3);
  await act(async () =>
    host
      .querySelectorAll<HTMLButtonElement>(".profile-ref-links button")[1]
      .click(),
  );
  expect(navigate).toHaveBeenCalledWith("documents");
  await act(async () => root.unmount());
});
it("does not fabricate profile details after load failure and allows retry", async () => {
  mock.get
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValueOnce({
      full_name: "علی",
      timezone: "Asia/Tehran",
      locale: "fa-IR",
    });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<Profile client={{} as SupabaseClient} onNavigate={vi.fn()} />),
  );
  expect(host.textContent).toContain("دریافت پروفایل ناموفق بود");
  expect(host.querySelector("form")).toBeNull();
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button.minor")!.click(),
  );
  expect(host.textContent).toContain("علی");
  await act(async () => root.unmount());
});
