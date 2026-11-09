export const DOCUMENT_VISIBILITIES = ["PRIVATE", "HOUSEHOLD_SHARED"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export const DOCUMENT_CATEGORIES = [
  "IDENTITY",
  "INSURANCE",
  "CONTRACT",
  "WARRANTY",
  "VEHICLE",
  "FINANCE",
  "HOME",
  "TRAVEL",
  "OTHER",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  IDENTITY: "هویتی",
  INSURANCE: "بیمه",
  CONTRACT: "قرارداد",
  WARRANTY: "گارانتی",
  VEHICLE: "خودرو",
  FINANCE: "مالی",
  HOME: "خانه",
  TRAVEL: "سفر",
  OTHER: "سایر",
};

export const DOCUMENT_ENTITY_TYPES = [
  "TASK",
  "EVENT",
  "CHORE",
  "SHOPPING_LIST",
  "FINANCE_RECORD",
  "APPLIANCE",
] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_BUCKET = "documents";
export const DOCUMENT_SIGNED_URL_SECONDS = 60;

export const DOCUMENT_ENTITY_LABELS: Record<DocumentEntityType, string> = {
  TASK: "تسک",
  EVENT: "رویداد",
  CHORE: "کار خانه",
  SHOPPING_LIST: "لیست خرید",
  FINANCE_RECORD: "مالی",
  APPLIANCE: "وسیله / خودرو",
};

export type DocumentRecord = {
  id: string;
  household_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  mime_type: string;
  file_size: number;
  storage_path: string;
  visibility: DocumentVisibility;
  issued_at?: string | null;
  expires_at?: string | null;
  issuer?: string | null;
  reference_code?: string | null;
  renewal_required?: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentRenewalRecord = {
  id: string;
  document_id: string;
  renewed_by: string;
  previous_expires_at: string | null;
  new_expires_at: string;
  renewed_at: string;
  note: string | null;
  replacement_document_id: string | null;
  request_id: string | null;
  created_at: string;
};

export type DocumentAttachment = {
  id: string;
  document_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  created_by: string;
  created_at: string;
};

export const DOCUMENT_SELECT =
  "id, household_id, created_by, title, description, mime_type, file_size, storage_path, visibility, issued_at, expires_at, issuer, reference_code, renewal_required, created_at, updated_at" as const;

export const DOCUMENT_ATTACHMENT_SELECT =
  "id, document_id, entity_type, entity_id, created_by, created_at" as const;
