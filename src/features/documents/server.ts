import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentEntityType } from "@/features/documents/types";

const ENTITY_TABLE: Record<DocumentEntityType, string> = {
  TASK: "tasks",
  EVENT: "events",
  CHORE: "chores",
  SHOPPING_LIST: "shopping_lists",
  FINANCE_RECORD: "finance_records",
};

export async function getCurrentDocumentMembership(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("FAILED_TO_LOAD_MEMBERSHIP");
  }

  return data;
}

export async function validateCreateDocumentForUser({
  userId,
  visibility,
}: {
  userId: string;
  visibility: "PRIVATE" | "HOUSEHOLD_SHARED";
}) {
  const membership = await getCurrentDocumentMembership(userId);

  if (visibility === "HOUSEHOLD_SHARED") {
    if (!membership?.household_id) {
      throw new Error("NO_HOUSEHOLD_FOR_SHARED_DOCUMENT");
    }
    return { householdId: membership.household_id };
  }

  return { householdId: null };
}

export async function entityExistsForUser(entityType: DocumentEntityType, entityId: string) {
  const supabase = await createSupabaseServerClient();
  const table = ENTITY_TABLE[entityType];
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", entityId)
    .maybeSingle();

  if (error) {
    throw new Error("FAILED_TO_LOAD_ENTITY");
  }

  return Boolean(data?.id);
}

export function mapDocumentError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("NO_HOUSEHOLD_FOR_SHARED_DOCUMENT")) {
      return "برای مدرک اشتراکی باید عضو یک خانه باشید.";
    }
    if (error.message.includes("DOCUMENT_ENTITY_ACCESS_DENIED")) {
      return "به این مورد دسترسی ندارید.";
    }
    if (error.message.includes("DOCUMENT_IMMUTABLE_FIELDS")) {
      return "تغییر فیلدهای مالکیت مدرک مجاز نیست.";
    }
    if (error.message.includes("FAILED_TO_LOAD_MEMBERSHIP")) {
      return "دریافت عضویت خانه ناموفق بود.";
    }
  }
  return "انجام عملیات مدرک ناموفق بود.";
}

export function documentErrorStatus(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("NO_HOUSEHOLD_FOR_SHARED_DOCUMENT")) {
      return 400;
    }
    if (error.message.includes("DOCUMENT_ENTITY_ACCESS_DENIED")) {
      return 404;
    }
  }
  return 400;
}

export function buildStoragePath({
  visibility,
  userId,
  householdId,
  documentId,
  fileName,
}: {
  visibility: "PRIVATE" | "HOUSEHOLD_SHARED";
  userId: string;
  householdId: string | null;
  documentId: string;
  fileName: string;
}) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
  if (visibility === "PRIVATE") {
    return `user/${userId}/${documentId}/${safe}`;
  }
  return `household/${householdId}/${documentId}/${safe}`;
}
