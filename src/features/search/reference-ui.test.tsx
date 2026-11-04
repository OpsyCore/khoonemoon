// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { Search } from "../../../mobile/src/search";

const api = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/features/search/direct-client", () => ({
  searchWorkspaceFiltered: api.search,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  history.replaceState({}, "", "/");
  vi.clearAllMocks();
});
it("renders authorized grouped results, applies filters and opens the matching section", async () => {
  history.replaceState({}, "", "/?search_q=خرید");
  api.search.mockResolvedValue({
    results: [
      {
        kind: "shopping_item",
        entity_id: "1",
        title: "خرید شیر",
        subtitle: "لبنیات",
        happened_at: "2026-10-01T12:00:00Z",
        status: "PURCHASED",
      },
    ],
    counts: { shopping_item: 1 },
    total: 1,
  });
  const navigate = vi.fn(),
    host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Search
        client={{} as SupabaseClient}
        userId="user1"
        onNavigate={navigate}
      />,
    );
  });
  expect(host.textContent).toContain("خرید شیر");
  expect(host.textContent).toContain("خریداری شد");
  expect(host.querySelector("mark")?.textContent).toBe("خرید");
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("رفتن به بخش خریدها"),
  )!;
  await act(async () => button.click());
  expect(navigate).toHaveBeenCalledWith("shopping_item");
  const filter = [
    ...host.querySelectorAll<HTMLButtonElement>(".search-ref-kinds button"),
  ].find((b) => b.textContent?.includes("تسک"))!;
  await act(async () => filter.click());
  expect(api.search.mock.calls.at(-1)?.[2].kinds).toEqual(["task"]);
  await act(async () => root.unmount());
});
it("loads and clears recent searches for the current account only", async () => {
  localStorage.setItem(
    "khoonemoon:search-history:user1",
    JSON.stringify(["قبض"]),
  );
  localStorage.setItem(
    "khoonemoon:search-history:user2",
    JSON.stringify(["خصوصی"]),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Search
        client={{} as SupabaseClient}
        userId="user1"
        onNavigate={vi.fn()}
      />,
    );
  });
  expect(host.textContent).toContain("قبض");
  expect(host.textContent).not.toContain("خصوصی");
  const clear = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "پاک کردن",
  )!;
  await act(async () => clear.click());
  expect(localStorage.getItem("khoonemoon:search-history:user1")).toBeNull();
  expect(
    localStorage.getItem("khoonemoon:search-history:user2"),
  ).not.toBeNull();
  await act(async () => root.unmount());
});
