// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Documents } from "../../../mobile/src/documents";

const mock = vi.hoisted(() => ({ list: vi.fn(), signedUrl: vi.fn() }));
vi.mock("@/features/documents/direct-client", () => ({
  directDocuments: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const record = (
  id: string,
  title: string,
  category: string,
  visibility: string,
) => ({
  id,
  title,
  category,
  visibility,
  file_size: 1024,
  created_at: "2024-10-01T10:00:00Z",
  description: null,
});

it("renders actual records with category and privacy, filters them, and opens the edit form", async () => {
  mock.list.mockResolvedValue([
    record("1", "شناسنامه", "IDENTITY", "PRIVATE"),
    record("2", "قرارداد", "HOME", "HOUSEHOLD_SHARED"),
  ]);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Documents client={{} as SupabaseClient} householdId="house" />,
    );
  });
  expect(host.querySelectorAll(".docs-card")).toHaveLength(2);
  expect(host.textContent).toContain("خصوصی");
  expect(host.textContent).toContain("مشترک");
  expect(host.textContent).not.toContain("هنوز مدرکی اضافه نکرده‌اید");
  const search = host.querySelector<HTMLInputElement>(".docs-search input")!;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setValue.call(search, "قرارداد");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelectorAll(".docs-card")).toHaveLength(1);
  await act(async () => {
    setValue.call(search, "");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const category = [
    ...host.querySelectorAll<HTMLButtonElement>(".docs-tabs button"),
  ].find((button) => button.textContent === "خانه")!;
  await act(async () => category.click());
  expect(host.querySelectorAll(".docs-card")).toHaveLength(1);
  expect(host.textContent).toContain("قرارداد");
  expect(host.querySelector(".docs-card")?.textContent).not.toContain(
    "شناسنامه",
  );
  const edit = [
    ...host.querySelectorAll<HTMLButtonElement>(".docs-menu button"),
  ].find((button) => button.textContent === "ویرایش")!;
  await act(async () => edit.click());
  expect(host.textContent).toContain("ویرایش مدرک");
  expect(
    (host.querySelector(".docs-form input") as HTMLInputElement).value,
  ).toBe("قرارداد");
  await act(async () => root.unmount());
});

it("distinguishes an empty archive from a failed load", async () => {
  mock.list
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("offline"));
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Documents client={{} as SupabaseClient} householdId={null} />);
  });
  expect(host.textContent).toContain("هنوز مدرکی اضافه نکرده‌اید");
  await act(async () => root.unmount());
  const second = createRoot(host);
  await act(async () => {
    second.render(
      <Documents client={{} as SupabaseClient} householdId={null} />,
    );
  });
  expect(host.textContent).toContain("دریافت مدارک ناموفق بود");
  expect(host.textContent).not.toContain("هنوز مدرکی اضافه نکرده‌اید");
  await act(async () => second.unmount());
});
