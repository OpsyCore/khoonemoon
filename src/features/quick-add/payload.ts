export type QuickAddKind = "task" | "event" | "shopping" | "bill" | "chore";

export type QuickVisibility = "PRIVATE" | "HOUSEHOLD_SHARED";

export type QuickAddResult = {
  message: string;
  href?: string;
};

/**
 * Local wall-clock value for <input type="datetime-local">.
 */
export function toDateTimeLocal(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Default event window for quick capture: next round hour, one hour long.
 */
export function defaultEventWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return { start, end };
}

/**
 * Accepts Persian/Arabic digits, thousands separators and stray spaces so the
 * amount field works with a Persian keyboard.
 */
export function parseAmount(input: string): number | null {
  const normalized = input
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[,٬\s]/g, "");

  if (!normalized) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return value;
}

export function buildQuickTaskPayload({
  title,
  visibility,
  dueAt,
}: {
  title: string;
  visibility: QuickVisibility;
  dueAt?: string | null;
}) {
  return {
    title: title.trim(),
    description: "",
    visibility,
    priority: "NORMAL" as const,
    status: "PENDING" as const,
    dueAt: dueAt ?? null,
    assigneeIds: [] as string[],
    recurrence: { frequency: "NONE" as const },
  };
}

export function buildQuickEventPayload({
  title,
  visibility,
  startAt,
  endAt,
}: {
  title: string;
  visibility: QuickVisibility;
  startAt: string;
  endAt: string;
}) {
  return {
    title: title.trim(),
    visibility,
    startAt,
    endAt,
    allDay: false,
  };
}

export function buildQuickShoppingPayload({
  name,
  listId,
  quantity,
}: {
  name: string;
  listId: string;
  quantity?: number | null;
}) {
  return {
    listId,
    name: name.trim(),
    quantity: quantity ?? null,
  };
}

export function buildQuickBillPayload({
  title,
  amount,
  visibility,
  dueAt,
}: {
  title: string;
  amount: number;
  visibility: QuickVisibility;
  dueAt?: string | null;
}) {
  return {
    title: title.trim(),
    amount,
    recordType: "EXPENSE" as const,
    visibility,
    dueAt: dueAt ?? null,
  };
}

export function buildQuickChorePayload({
  title,
  frequency,
}: {
  title: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
}) {
  return {
    title: title.trim(),
    rotationMode: "FIXED" as const,
    frequency,
    assigneeIds: [] as string[],
  };
}

export const QUICK_ADD_ENDPOINTS: Record<QuickAddKind, string> = {
  task: "/api/tasks",
  event: "/api/events",
  shopping: "/api/shopping/items",
  bill: "/api/finance",
  chore: "/api/chores",
};

const KIND_LABELS: Record<QuickAddKind, string> = {
  task: "تسک",
  event: "رویداد",
  shopping: "آیتم خرید",
  bill: "هزینه",
  chore: "کار خانه",
};

export function successMessage(kind: QuickAddKind): QuickAddResult {
  return { message: `${KIND_LABELS[kind]} با موفقیت اضافه شد.` };
}
