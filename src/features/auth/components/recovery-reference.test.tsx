// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RecoveryReference } from "./recovery-reference";
import { ForgotPasswordForm } from "./forgot-password-form";
const mocks = vi.hoisted(() => ({ send: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  openSupabaseBrowserClient: mocks.open,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
it("keeps the mobile email entry, submit and back controls functional", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    setEmail = vi.fn(),
    submit = vi.fn((e: React.FormEvent) => e.preventDefault()),
    back = vi.fn();
  await act(async () =>
    root.render(
      <RecoveryReference
        email=""
        setEmail={setEmail}
        busy={false}
        onSubmit={submit}
        onBack={back}
      />,
    ),
  );
  expect(host.textContent).toContain("رمز عبورت رو فراموش کردی؟");
  await act(async () =>
    setInput(host.querySelector("input")!, "a@example.com"),
  );
  expect(setEmail).toHaveBeenCalledWith("a@example.com");
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(submit).toHaveBeenCalledOnce();
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".recovery-back")!.click(),
  );
  expect(back).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});
it("web requests a trimmed address with the existing PKCE callback and shows a generic result", async () => {
  mocks.send.mockResolvedValue({ error: null });
  mocks.open.mockReturnValue({
    client: { auth: { resetPasswordForEmail: mocks.send } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<ForgotPasswordForm />));
  await act(async () =>
    setInput(host.querySelector("input")!, "person@example.com"),
  );
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mocks.send).toHaveBeenCalledWith("person@example.com", {
    redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/update-password`,
  });
  expect(host.textContent).toContain("اگر حسابی با این ایمیل وجود داشته باشد");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/auth/login");
  await act(async () => root.unmount());
});
it("reports configuration and network failures", async () => {
  mocks.open.mockReturnValue({ error: "تنظیمات اتصال موجود نیست" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<ForgotPasswordForm />));
  await act(async () =>
    setInput(host.querySelector("input")!, "person@example.com"),
  );
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(host.textContent).toContain("تنظیمات اتصال موجود نیست");
  mocks.open.mockReturnValue({
    client: { auth: { resetPasswordForEmail: mocks.send } },
  });
  mocks.send.mockRejectedValue(new Error("network"));
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(host.querySelector('[role="status"]')?.textContent).toBeTruthy();
  expect(
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
  ).toBe(false);
  await act(async () => root.unmount());
});
