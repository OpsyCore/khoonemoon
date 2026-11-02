// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MobileLogin } from "../../../../mobile/src/login";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
});

it("mobile login keeps submit, password visibility, recovery and signup actions working", async () => {
  const submit = vi.fn((e) => e.preventDefault()),
    signup = vi.fn(),
    forgot = vi.fn();
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () =>
    root.render(
      <MobileLogin
        email="test@example.com"
        setEmail={vi.fn()}
        password="secret"
        setPassword={vi.fn()}
        busy={false}
        onSubmit={submit}
        onForgot={forgot}
        onSignup={signup}
        theme="light"
        setTheme={vi.fn()}
        themePersisted
      />,
    ),
  );
  expect(
    node
      .querySelector('input[autocomplete="current-password"]')!
      .getAttribute("type"),
  ).toBe("password");
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="نمایش رمز عبور"]')!
      .click(),
  );
  expect(
    node
      .querySelector('input[autocomplete="current-password"]')!
      .getAttribute("type"),
  ).toBe("text");
  expect(submit).not.toHaveBeenCalled();
  await act(async () =>
    node.querySelector<HTMLButtonElement>(".login-forgot")!.click(),
  );
  await act(async () =>
    node.querySelector<HTMLButtonElement>(".login-signup button")!.click(),
  );
  await act(async () =>
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(forgot).toHaveBeenCalledOnce();
  expect(signup).toHaveBeenCalledOnce();
  expect(submit).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it("web login preserves POST, accessible controls and links", async () => {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => root.render(<LoginForm />));
  expect(node.querySelector("form")!.method).toBe("post");
  expect(
    node
      .querySelector<HTMLAnchorElement>(".login-forgot")!
      .getAttribute("href"),
  ).toBe("/auth/forgot-password");
  expect(
    node
      .querySelector<HTMLAnchorElement>(".login-signup a")!
      .getAttribute("href"),
  ).toBe("/auth/signup");
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>('[aria-label="نمایش رمز عبور"]')!
      .click(),
  );
  expect(
    node
      .querySelector('input[autocomplete="current-password"]')!
      .getAttribute("type"),
  ).toBe("text");
  await act(async () => root.unmount());
});
