import { pendingCreate, pendingRequest } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApplianceSchema, recordMaintenanceSchema } from "./schemas";
import type { ApplianceMaintenanceLog, HomeApplianceRecord } from "./types";

const COLUMNS =
  "id, household_id, owner_id, created_by, visibility, name, appliance_group, brand, model, serial_number, purchased_on, warranty_until, last_service_on, next_service_at, service_interval_days, recurrence_timezone, assignee_id, notes, service_revision, archived_at, created_at, updated_at";

const LOG_COLUMNS =
  "id, appliance_id, performed_by, kind, title, performed_on, cost_amount, technician_name, technician_contact, financial_record_id, document_id, notes, next_service_at, request_id, created_at";

async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}

async function resolveHousehold(
  client: SupabaseClient,
  user: string,
  visibility: HomeApplianceRecord["visibility"],
) {
  if (visibility !== "HOUSEHOLD_SHARED") return null;
  const { data, error } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user)
    .is("left_at", null)
    .maybeSingle();
  if (error || !data?.household_id)
    throw new Error("برای ثبت وسیله مشترک باید عضو خانه باشید.");
  return data.household_id as string;
}

function toApplianceFields(
  item: ReturnType<typeof createApplianceSchema.parse>,
  householdId: string | null,
) {
  return {
    household_id: householdId,
    visibility: item.visibility,
    name: item.name,
    appliance_group: item.applianceGroup,
    brand: item.brand || null,
    model: item.model || null,
    serial_number: item.serialNumber || null,
    purchased_on: item.purchasedOn || null,
    warranty_until: item.warrantyUntil || null,
    last_service_on: item.lastServiceOn || null,
    next_service_at: item.nextServiceAt || null,
    service_interval_days: item.serviceIntervalDays ?? null,
    assignee_id: item.assigneeId || null,
    notes: item.notes || null,
  };
}

export function directAppliances(client: SupabaseClient) {
  return {
    async list(): Promise<HomeApplianceRecord[]> {
      const rows: HomeApplianceRecord[] = [];
      for (let offset = 0; offset <= 10000; offset += 500) {
        const { data, error } = await client
          .from("home_appliances")
          .select(COLUMNS)
          .is("archived_at", null)
          .order("next_service_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(offset, offset + 499);
        if (error) throw new Error("دریافت فهرست وسایل ناموفق بود.");
        if (offset === 10000 && data?.length)
          throw new Error("تعداد وسایل بیش از حد مجاز است.");
        rows.push(...((data ?? []) as HomeApplianceRecord[]));
        if (!data || data.length < 500) return rows;
      }
      return rows;
    },
    async logs(applianceId?: string): Promise<ApplianceMaintenanceLog[]> {
      let query = client
        .from("appliance_maintenance_logs")
        .select(LOG_COLUMNS)
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (applianceId) query = query.eq("appliance_id", applianceId);
      const { data, error } = await query;
      if (error) throw new Error("دریافت سابقه تعمیرات ناموفق بود.");
      return (data ?? []) as ApplianceMaintenanceLog[];
    },
    async create(input: unknown): Promise<HomeApplianceRecord> {
      const item = createApplianceSchema.parse(input);
      const user = await currentUser(client);
      const householdId = await resolveHousehold(client, user, item.visibility);
      const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran";
      return pendingCreate<HomeApplianceRecord>({
        user,
        kind: "appliance",
        input: { item, householdId, tz },
        submit: (id) =>
          client
            .from("home_appliances")
            .insert({
              id,
              owner_id: user,
              created_by: user,
              recurrence_timezone: tz,
              ...toApplianceFields(item, householdId),
            })
            .select(COLUMNS)
            .single(),
        find: (id) =>
          client
            .from("home_appliances")
            .select(COLUMNS)
            .eq("id", id)
            .maybeSingle(),
      });
    },
    async update(id: string, input: unknown, expectedRevision: number) {
      const item = createApplianceSchema.parse(input);
      const user = await currentUser(client);
      const householdId = await resolveHousehold(client, user, item.visibility);
      const { data, error } = await client
        .from("home_appliances")
        .update(toApplianceFields(item, householdId))
        .eq("id", id)
        .eq("service_revision", expectedRevision)
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data)
        throw new Error("ویرایش وسیله تأیید نشد؛ فهرست را تازه کنید.");
      return data as HomeApplianceRecord;
    },
    async archive(id: string): Promise<void> {
      const { data, error } = await client
        .from("home_appliances")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("بایگانی وسیله ناموفق بود.");
    },
    async recordMaintenance(input: unknown): Promise<string> {
      const parsed = recordMaintenanceSchema.parse(input);
      const user = await currentUser(client);
      return pendingRequest<string>({
        user,
        kind: "appliance-maintenance",
        input: parsed,
        submit: (requestId) =>
          client.rpc("record_appliance_maintenance", {
            p_input: { ...parsed, requestId },
          }),
        valid: (val): val is string =>
          typeof val === "string" && /^[0-9a-f-]{36}$/i.test(val),
      });
    },
  };
}
