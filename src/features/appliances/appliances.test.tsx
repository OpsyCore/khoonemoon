// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplianceSchema, recordMaintenanceSchema } from "./schemas";
import { Appliances } from "../../../mobile/src/appliances";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  logs: vi.fn(),
  create: vi.fn(),
  recordMaintenance: vi.fn(),
  docs: vi.fn(),
  members: vi.fn(),
}));

vi.mock("@/features/appliances/direct-client", () => ({
  directAppliances: () => ({
    list: mocks.list,
    logs: mocks.logs,
    create: mocks.create,
    recordMaintenance: mocks.recordMaintenance,
  }),
}));
vi.mock("@/features/documents/direct-client", () => ({
  directDocuments: () => ({ list: mocks.docs }),
}));
vi.mock("@/features/households/members", () => ({
  loadHouseholdMembers: mocks.members,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("appliances & maintenance", () => {
  it("validates appliance purchase/warranty dates and maintenance payloads", () => {
    expect(
      createApplianceSchema.safeParse({
        name: "پکیج دیواری",
        visibility: "HOUSEHOLD_SHARED",
        applianceGroup: "SYSTEM",
        purchasedOn: "2025-05-10",
        warrantyUntil: "2024-05-10",
      }).success,
    ).toBe(false);

    expect(
      recordMaintenanceSchema.safeParse({
        applianceId: "11111111-1111-4111-8111-111111111111",
        kind: "REPAIR",
        title: "تعویض پمپ",
        costAmount: 2500000,
        recordInFinance: true,
      }).success,
    ).toBe(true);
  });

  it("renders appliances, assignee, due service status and maintenance history", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "app-1",
        household_id: "h1",
        owner_id: "u1",
        created_by: "u1",
        visibility: "HOUSEHOLD_SHARED",
        name: "ماشین ظرفشویی",
        appliance_group: "APPLIANCE",
        brand: "بوش",
        model: "SMS46",
        serial_number: "SN-99",
        purchased_on: "2024-03-01",
        warranty_until: "2027-03-01",
        last_service_on: "2026-04-01",
        next_service_at: "2026-10-01T09:00:00Z",
        service_interval_days: 180,
        recurrence_timezone: "Asia/Tehran",
        assignee_id: "u2",
        notes: "استفاده از نمک مخصوص",
        service_revision: 1,
        archived_at: null,
        created_at: "2024-03-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
    ]);
    mocks.logs.mockResolvedValue([
      {
        id: "log-1",
        appliance_id: "app-1",
        performed_by: "u1",
        kind: "SERVICE",
        title: "جرم‌گیری کامل",
        performed_on: "2026-04-01",
        cost_amount: 900000,
        technician_name: "آقای حسینی",
        technician_contact: "09121112233",
        financial_record_id: null,
        document_id: null,
        notes: null,
        next_service_at: "2026-10-01T09:00:00Z",
        request_id: null,
        created_at: "2026-04-01T10:00:00Z",
      },
    ]);
    mocks.docs.mockResolvedValue([]);
    mocks.members.mockResolvedValue({
      data: [
        {
          id: "member-2",
          user_id: "u2",
          role: "MEMBER",
          joined_at: "2025-01-01T00:00:00Z",
          left_at: null,
          profiles: [{ full_name: "سارا" }],
        },
      ],
      error: null,
    });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <Appliances client={{} as SupabaseClient} householdId="h1" />,
      );
    });

    expect(host.textContent).toContain("ماشین ظرفشویی");
    expect(host.textContent).toContain("بوش · SMS46");
    expect(host.textContent).toContain("مسئول: سارا");
    expect(host.textContent).toContain("سررسید سرویس");
    expect(host.textContent).toContain("جرم‌گیری کامل");
    await act(async () => root.unmount());
  });
});
