// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { HomeDashboard } from "../../../mobile/src/home-dashboard";

const mock = vi.hoisted(() => ({
  details: vi.fn(),
  invite: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
}));
vi.mock("@/features/households/direct-client", () => ({
  directHousehold: () => mock,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const details = {
  house: { name: "خانه واقعی" },
  role: "OWNER",
  members: [
    { user_id: "u1", name: "مریم", role: "OWNER" },
    { user_id: "u2", name: "علی", role: "MEMBER" },
  ],
  invitations: [],
};
function client(fail = false): SupabaseClient {
  return {
    from: (table: string) => {
      let head = false;
      let status = "";
      const q = {
        select: (_columns: string, opts?: { head?: boolean }) => {
          head = !!opts?.head;
          return q;
        },
        eq: (field: string, value: string) => {
          if (field === "status") status = value;
          return q;
        },
        is: () => q,
        in: () => q,
        gte: () => q,
        lt: () => q,
        order: () => q,
        limit: () => q,
        then: (resolve: (value: object) => void) =>
          Promise.resolve(
            fail
              ? { error: new Error("offline") }
              : head
                ? {
                    error: null,
                    count:
                      table === "events" ? 4 : status === "COMPLETED" ? 7 : 3,
                  }
                : {
                    error: null,
                    data:
                      table === "tasks"
                        ? [
                            {
                              id: "a",
                              title: "کار واقعی",
                              created_at: "2024-01-01T10:00:00Z",
                            },
                          ]
                        : [],
                  },
          ).then(resolve),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}
function props(c: SupabaseClient, householdId: string | null = "home") {
  return {
    client: c,
    userId: "u1",
    householdId,
    onHouseholdChange: vi.fn(),
    onSettings: vi.fn(),
    onTasks: vi.fn(),
    onCalendar: vi.fn(),
  };
}

it("shows real members, counts and recent items, and creates an explicit invitation", async () => {
  mock.details.mockResolvedValue(details);
  mock.invite.mockResolvedValue({
    code: "abcdefghijklmnop",
    expiresAt: "2030-01-01T00:00:00Z",
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<HomeDashboard {...props(client())} />));
  expect(host.textContent).toContain("خانه واقعی");
  expect(host.textContent).toContain("مریم");
  expect(host.textContent).toContain("علی");
  expect(host.textContent).toContain("کار واقعی");
  expect(host.querySelector(".home-ref-stats")?.textContent).toContain("۳");
  expect(host.querySelector(".home-ref-stats")?.textContent).toContain("۷");
  expect(mock.invite).not.toHaveBeenCalled();
  const invite = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (x) => x.textContent === "ساخت کد دعوت",
  )!;
  await act(async () => invite.click());
  expect(mock.invite).toHaveBeenCalledWith("u1", "home");
  expect(
    (host.querySelector(".home-ref-code input") as HTMLInputElement).value,
  ).toBe("abcdefghijklmnop");
  await act(async () => root.unmount());
});

it("does not present failed overview queries as zero and offers join for users without a house", async () => {
  mock.details.mockResolvedValue(details);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<HomeDashboard {...props(client(true))} />),
  );
  expect(host.querySelector(".home-ref-stats")?.textContent).toContain("—");
  expect(host.textContent).toContain("دریافت موارد اخیر ناموفق بود");
  await act(async () => root.unmount());
  const other = createRoot(host);
  await act(async () =>
    other.render(
      <HomeDashboard
        {...props(client(), null)}
        initialInviteCode="abcdefghijklmnop"
      />,
    ),
  );
  expect(host.textContent).toContain("هنوز خانه‌ای ندارید");
  expect(
    (host.querySelector(".home-ref-entry-form input") as HTMLInputElement)
      .value,
  ).toBe("abcdefghijklmnop");
  await act(async () => other.unmount());
});
