// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Meals } from "../../../mobile/src/meals";
import { localDate } from "./model";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/features/meals/direct-client", () => ({ directMeals: () => api }));
const shoppingApi = vi.hoisted(() => ({ lists: vi.fn() }));
vi.mock("@/features/shopping/direct-client", () => ({
  directShopping: () => shoppingApi,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
it("shows the selected day's real meal and navigates to shopping", async () => {
  api.list.mockResolvedValue([
    {
      id: "a",
      meal_date: localDate(new Date()),
      meal_type: "lunch",
      title: "عدس پلو",
      minutes: 40,
      assignee: "علی",
      ingredients: "برنج\nعدس",
      image_choice: null,
    },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const shopping = vi.fn();
  await act(async () =>
    root.render(
      <Meals
        client={{} as SupabaseClient}
        householdId="house"
        onShopping={shopping}
        onHouse={() => {}}
      />,
    ),
  );
  expect(host.querySelectorAll(".meal-card")).toHaveLength(3);
  expect(host.textContent).toContain("عدس پلو");
  expect(host.querySelector(".meals-ingredients")?.textContent).toContain(
    "عدس",
  );
  await act(async () =>
    (
      host.querySelector(".meals-ingredients button") as HTMLButtonElement
    ).click(),
  );
  expect(shopping).toHaveBeenCalled();
  await act(async () =>
    (host.querySelector(".meals-add") as HTMLButtonElement).click(),
  );
  expect(host.querySelector("form")?.textContent).toContain("افزودن وعده");
  await act(async () => root.unmount());
});
it("shows no invented meal entries on an empty week", async () => {
  api.list.mockResolvedValue([]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Meals
        client={{} as SupabaseClient}
        householdId="house"
        onShopping={() => {}}
        onHouse={() => {}}
      />,
    ),
  );
  expect(host.textContent).toContain("وعده‌ای ثبت نشده");
  expect(host.textContent).not.toContain("قرمه‌سبزی");
  await act(async () => root.unmount());
});

it("lets the user choose ingredients and reports a retry-safe transfer", async () => {
  api.list.mockResolvedValue([
    {
      id: "a",
      meal_date: localDate(new Date()),
      meal_type: "lunch",
      title: "برنج",
      minutes: null,
      assignee: null,
      ingredients: "برنج\nعدس",
      image_choice: null,
    },
  ]);
  shoppingApi.lists.mockResolvedValue([{ id: "list-1", name: "خانه" }]);
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { inserted: 1, skipped: 0 }, error: null });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Meals
        client={{ rpc } as unknown as SupabaseClient}
        householdId="house"
        onShopping={() => {}}
        onHouse={() => {}}
      />,
    ),
  );
  const open = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("انتخاب و افزودن مواد"),
  )!;
  await act(async () => open.click());
  const inputs = host.querySelectorAll<HTMLInputElement>(
    ".meals-transfer input[type=checkbox]",
  );
  expect(inputs).toHaveLength(2);
  await act(async () => inputs[1].click());
  const send = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("افزودن موارد انتخاب‌شده"),
  )!;
  await act(async () => send.click());
  expect(rpc).toHaveBeenCalledWith("mobile_add_meal_ingredients", {
    p_list: "list-1",
    p_names: ["برنج"],
  });
  expect(host.textContent).toContain("ماده اضافه شد");
  await act(async () => root.unmount());
});
