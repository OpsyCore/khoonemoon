// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MobileLogin } from "../../../../mobile/src/login";
import { LoginForm } from "./login-form";

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  openSupabaseBrowserClient: () => ({
    client: { auth: { signInWithPassword: auth.signIn } },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: auth.replace, refresh: auth.refresh }),
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

it("web submits credentials through the authenticated client and navigates after success", async () => {
  auth.signIn.mockResolvedValue({ error: null });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => root.render(<LoginForm />));
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    const email = node.querySelector<HTMLInputElement>('input[type="email"]')!;
    const password = node.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    setValue.call(email, "member@example.com");
    email.dispatchEvent(new Event("input", { bubbles: true }));
    setValue.call(password, "password123");
    password.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(auth.signIn).toHaveBeenCalledWith({
    email: "member@example.com",
    password: "password123",
  });
  expect(auth.replace).toHaveBeenCalled();
  expect(auth.refresh).toHaveBeenCalled();
  await act(async () => root.unmount());
});
