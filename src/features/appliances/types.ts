export type ApplianceVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";
export type ApplianceGroup = "APPLIANCE" | "SYSTEM" | "VEHICLE" | "OTHER";
export type MaintenanceKind = "SERVICE" | "REPAIR" | "INSPECTION";

export const APPLIANCE_GROUP_LABELS: Record<ApplianceGroup, string> = {
  APPLIANCE: "لوازم خانگی",
  SYSTEM: "تأسیسات خانه",
  VEHICLE: "خودرو و وسیله نقلیه",
  OTHER: "سایر تجهیزات",
};

export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  SERVICE: "سرویس دوره‌ای",
  REPAIR: "تعمیر",
  INSPECTION: "بازدید فنی",
};

export type HomeApplianceRecord = {
  id: string;
  household_id: string | null;
  owner_id: string;
  created_by: string;
  visibility: ApplianceVisibility;
  name: string;
  appliance_group: ApplianceGroup;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchased_on: string | null;
  warranty_until: string | null;
  last_service_on: string | null;
  next_service_at: string | null;
  service_interval_days: number | null;
  recurrence_timezone: string;
  assignee_id: string | null;
  notes: string | null;
  service_revision: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplianceMaintenanceLog = {
  id: string;
  appliance_id: string;
  performed_by: string;
  kind: MaintenanceKind;
  title: string;
  performed_on: string;
  cost_amount: number | null;
  technician_name: string | null;
  technician_contact: string | null;
  financial_record_id: string | null;
  document_id: string | null;
  notes: string | null;
  next_service_at: string | null;
  request_id: string | null;
  created_at: string;
};
