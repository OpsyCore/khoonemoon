import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import ListsPage from "./page";

const mocks = vi.hoisted(() => ({ client: vi.fn(), members: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/features/households/members", () => ({
  loadHouseholdMembers: mocks.members,
}));
vi.mock("@/features/lists/components/lists-tabs", () => ({
  ListsTabs: () => <div>lists loaded</div>,
}));

beforeEach(() => vi.resetAllMocks());

function setup(membershipError: boolean) {
  const from = vi.fn((table: string) => {
    const result = { data: [], error: null };
    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: membershipError ? null : { household_id: "h" },
        error: membershipError ? new Error("offline") : null,
      }),
      then: (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    if (table === "chore_completions")
      throw new Error("unexpected history query");
    return builder;
  });
  mocks.client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
    from,
  });
  return from;
}

it("does not mistake a membership lookup failure for a user without a household", async () => {
  const from = setup(true);
  expect(renderToStaticMarkup(await ListsPage())).toContain(
    "خطا در دریافت عضویت",
  );
  expect(from).toHaveBeenCalledTimes(1);
});

it("shows a member loading error rather than a fabricated one-person household", async () => {
  setup(false);
  mocks.members.mockResolvedValue({ data: [], error: new Error("offline") });
  const html = renderToStaticMarkup(await ListsPage());
  expect(html).toContain("خطا در دریافت اعضای خانه");
  expect(html).not.toContain("lists loaded");
});
