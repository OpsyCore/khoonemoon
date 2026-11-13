import { z } from "zod";

export const ASSISTANT_INTENTS = [
  "greeting",
  "today_tasks",
  "upcoming_reminders",
  "calendar_events",
  "shopping_list",
  "meal_plan",
  "upcoming_bills",
  "expiring_documents",
  "maintenance_schedule",
  "household_summary",
  "create_household_task",
  "create_reminder",
  "add_shopping_item",
  "unsupported_inventory",
  "unsupported_meal_suggestion",
  "unknown",
] as const;
export const assistantIntentSchema = z.enum(ASSISTANT_INTENTS);
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;

export const assistantEngineStatusSchema = z.enum([
  "cloud_available",
  "cloud_rate_limited",
  "cloud_unavailable",
  "cloud_timeout",
  "cloud_model_disabled",
  "internal_active",
]);
export type AssistantEngineStatus = z.infer<typeof assistantEngineStatusSchema>;

export type InternalIntent = {
  intent: AssistantIntent;
  taskTitle?: string;
  shoppingItemName?: string;
  reminderTargetTitle?: string;
  reminderDate?: "today" | "tomorrow";
  reminderTime?: string;
};

export function normalizePersianText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

function takeAfterColon(text: string) {
  const colon = text.indexOf(":");
  return colon < 0
    ? ""
    : text
        .slice(colon + 1)
        .trim()
        .replace(/[.!؟،]+$/g, "");
}

function shoppingItem(text: string) {
  const afterColon = takeAfterColon(text);
  if (afterColon) return afterColon;
  const match = text.match(
    /(?:به\s+)?(?:لیست\s+)?خرید\s+(?:اضافه\s+کن|اضافه\s+شود|ثبت\s+کن)\s+(.+)$/,
  );
  return match?.[1]?.trim().replace(/[.!؟،]+$/g, "") ?? "";
}

function taskTitle(text: string) {
  const afterColon = takeAfterColon(text);
  if (afterColon) return afterColon;
  const match = text.match(
    /(?:کار|وظیفه)\s+(?:جدید\s+)?(?:اضافه\s+کن|بساز|ثبت\s+کن)\s+(.+)$/,
  );
  return match?.[1]?.trim().replace(/[.!؟،]+$/g, "") ?? "";
}

function reminderDraft(text: string) {
  const dateMatch = text.match(/(?:^|\s)(امروز|فردا)(?=\s|$)/);
  const timeMatch = text.match(/(?:ساعت\s*)?(\d{1,2})\s*[:٫.]\s*(\d{2})/);
  const targetMatch = text.match(
    /(?:یادآور|یادآوری).{0,32}?(?:برای|رو|روی)\s+(.+?)(?=\s+(?:امروز|فردا)(?:\s|$)|$)/,
  );
  return {
    reminderTargetTitle: targetMatch?.[1]?.trim().replace(/[،.!؟]+$/g, ""),
    reminderDate: dateMatch
      ? dateMatch[1] === "امروز"
        ? "today"
        : "tomorrow"
      : undefined,
    reminderTime:
      timeMatch && Number(timeMatch[1]) <= 23 && Number(timeMatch[2]) <= 59
        ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
        : undefined,
  } as const;
}

/** Bounded rule-based Persian intent detection; never invents records or facts. */
export function parseInternalIntent(message: string): InternalIntent {
  const text = normalizePersianText(message);
  if (!text) return { intent: "unknown" };

  if (/^(?:سلام|درود|صبح بخیر|عصر بخیر|وقت بخیر)[\s،!؟,.]*$/.test(text))
    return { intent: "greeting" };

  if (/موجودی|کمبود|یخچال|انبار/.test(text))
    return { intent: "unsupported_inventory" };

  if (/چی\s*بپزم|پیشنهاد\s*(?:غذا|ناهار|شام)|غذا\s*(?:چی|پیشنهاد)/.test(text))
    return { intent: "unsupported_meal_suggestion" };

  if (
    /یادآور|یادآوری/.test(text) &&
    /(?:بساز|ایجاد|ثبت|تنظیم|بذار|بگذار)/.test(text)
  )
    return { intent: "create_reminder", ...reminderDraft(text) };

  if (/خرید|سبد/.test(text) && /(?:اضافه|ثبت|بخر)/.test(text))
    return {
      intent: "add_shopping_item",
      shoppingItemName: shoppingItem(text),
    };

  if (
    /(?:کار|وظیفه)/.test(text) &&
    (/(?:اضافه|بساز|ثبت)/.test(text) || /(?:کار|وظیفه)\s+جدید\s*:/.test(text))
  )
    return { intent: "create_household_task", taskTitle: taskTitle(text) };

  if (/امروز/.test(text) && /(?:کار|وظیفه|تسک)/.test(text))
    return { intent: "today_tasks" };
  if (/یادآور|یادآوری/.test(text)) return { intent: "upcoming_reminders" };
  if (/تقویم|رویداد|قرار/.test(text)) return { intent: "calendar_events" };
  if (/لیست\s*خرید|فهرست\s*خرید|خریدهام|خریدهای/.test(text))
    return { intent: "shopping_list" };
  if (/برنامه\s*غذایی|وعده|غذاهای\s*(?:این\s*)?هفته/.test(text))
    return { intent: "meal_plan" };
  if (/قبض|قسط|پرداخت/.test(text)) return { intent: "upcoming_bills" };
  if (/مدرک|سند/.test(text) && /انقضا|تمدید|سررسید|نزدیک/.test(text))
    return { intent: "expiring_documents" };
  if (/مدرک|سند/.test(text)) return { intent: "expiring_documents" };
  if (/تعمیر|سرویس|وسیله|لوازم\s*خانگی/.test(text))
    return { intent: "maintenance_schedule" };
  if (/خلاصه|وضعیت\s*خانه|گزارش\s*خانه/.test(text))
    return { intent: "household_summary" };

  return { intent: "unknown" };
}

export function canOfferAction(intent: AssistantIntent) {
  return (
    intent === "create_household_task" ||
    intent === "create_reminder" ||
    intent === "add_shopping_item"
  );
}

export function toLocalDateTimeIso(
  date: "today" | "tomorrow",
  time: string,
  timeZone: string,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  const localDay = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + (date === "tomorrow" ? 1 : 0),
    ),
  );
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth(),
    localDay.getUTCDate(),
    hour,
    minute,
  );
  let instant = desired;
  for (let pass = 0; pass < 4; pass++) {
    const current = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA-u-nu-latn", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    ) as Record<string, number>;
    const represented = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
    );
    const adjustment = desired - represented;
    instant += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(instant).toISOString();
}

export function freeModelIsApproved(
  modelId: string,
  approvedIds: readonly string[],
  catalog: {
    id: string;
    promptPrice?: string | number;
    completionPrice?: string | number;
    supportedParameters?: string[];
  }[],
) {
  if (!approvedIds.includes(modelId)) return false;
  const model = catalog.find((candidate) => candidate.id === modelId);
  const isZero = (value: string | number | undefined) =>
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) === 0;
  return (
    !!model &&
    isZero(model.promptPrice) &&
    isZero(model.completionPrice) &&
    model.supportedParameters?.includes("response_format") === true
  );
}
