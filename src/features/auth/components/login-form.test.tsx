import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LoginForm } from "./login-form";

describe("login form", () => {
  it("uses POST even before client handlers are available", () => {
    expect(renderToStaticMarkup(<LoginForm />)).toContain('method="post"');
  });
});
