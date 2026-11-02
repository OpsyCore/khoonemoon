// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Shopping } from "../../../mobile/src/shopping";

const mock = vi.hoisted(() => ({
  lists: vi.fn(),
  items: vi.fn(),
  updateItem: vi.fn(),
}));
vi.mock("@/features/shopping/direct-client", () => ({
  directShopping: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

it("shows real counts, filters without losing other categories, and opens the editing form", async () => {
  mock.lists.mockResolvedValue([{ id: "list", name: "خرید هفتگی" }]);
  mock.items.mockResolvedValue([
    {
      id: "1",
      name: "شیر",
      category: "خوراکی",
      purchased: false,
      quantity: 1,
      unit: "لیتر",
    },
    {
      id: "2",
      name: "صابون",
      category: "بهداشتی",
      purchased: true,
      quantity: 2,
      unit: "عدد",
    },
  ]);
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const client = {
    channel: () => channel,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Shopping client={client} householdId="house" />);
  });
  expect(host.textContent).toContain("۵۰٪");
  expect(host.textContent).toContain("شیر");
  expect(host.textContent).toContain("صابون");
  const category = Array.from(
    host.querySelectorAll<HTMLButtonElement>(".shopping-categories button"),
  ).find((b) => b.textContent === "خوراکی")!;
  await act(async () => category.click());
  expect(host.textContent).toContain("شیر");
  expect(host.textContent).not.toContain("صابون");
  await act(async () =>
    (
      host.querySelector(".shopping-item-menu button") as HTMLButtonElement
    ).click(),
  );
  expect(host.textContent).toContain("ویرایش قلم");
  expect(
    (host.querySelector(".shopping-form-card input") as HTMLInputElement).value,
  ).toBe("شیر");
  await act(async () => root.unmount());
});
