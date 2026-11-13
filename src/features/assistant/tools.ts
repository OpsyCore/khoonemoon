import type { SupabaseClient } from "@supabase/supabase-js";
import { directAppliances } from "@/features/appliances/direct-client";
import { directCalendar } from "@/features/calendar/direct-client";
import { directDocuments } from "@/features/documents/direct-client";
import { describeDocumentExpiry } from "@/features/documents/expiry";
import { directFinance } from "@/features/finance/direct-client";
import { directMeals } from "@/features/meals/direct-client";
import { directReminders } from "@/features/reminders/direct-client";
import { directShopping } from "@/features/shopping/direct-client";
import { directTasks } from "@/features/tasks/direct-client";
import { getJalaliWeekRange } from "@/shared/utils/jalali";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianNumber,
} from "@/shared/utils/locale";
import {
  canOfferAction,
  normalizePersianText,
  toLocalDateTimeIso,
  type AssistantIntent,
  type InternalIntent,
} from "./core";
import {
  assistantActionSchema,
  signAssistantAction,
  type AssistantAction,
} from "./actions";

export type AssistantToolResult = {
  intent: AssistantIntent;
  text: string;
  action?: {
    type: "create_household_task" | "create_reminder" | "add_shopping_item";
    label: string;
    summary: string;
    token: string;
  };
};

export type AssistantToolContext = {
  client: SupabaseClient;
  userId: string;
  householdId: string | null;
  timeZone: string;
  message: string;
  now: Date;
  actionSecret?: string;
};

function dateKey(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA-u-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function atLocalDate(now: Date, timeZone: string, end = false) {
  return new Date(
    toLocalDateTimeIso("today", end ? "23:59" : "00:00", timeZone, now),
  ).getTime();
}

function sayList(title: string, rows: string[], empty: string) {
  return rows.length
    ? `${title}\n${rows.map((row) => `• ${row}`).join("\n")}`
    : empty;
}

function ensureTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("fa-IR", { timeZone: value });
    return value;
  } catch {
    return "Asia/Tehran";
  }
}

export function canShare(text: string) {
  const normalized = normalizePersianText(text);
  if (
    /غیر\s*مشترک|مشترک\s+(?:نیست|نباشد|نمی\s*خواهم)|خصوصی|فقط\s+برای\s+من|کار\s+شخصی|نه\s+برای\s+همه/.test(
      normalized,
    )
  )
    return false;
  return /(?:^|[\s،])(?:کار\s+)?مشترک(?:$|[\s،:：])|برای\s+همه|همه\s+خانه|خانوادگی/.test(
    normalized,
  );
}

async function createProposal(
  actionInput: AssistantAction,
  summary: string,
  context: AssistantToolContext,
): Promise<AssistantToolResult["action"] | undefined> {
  if (!context.actionSecret || context.actionSecret.length < 32)
    return undefined;
  const action = assistantActionSchema.parse(actionInput);
  const signed = await signAssistantAction(
    action,
    { userId: context.userId, householdId: context.householdId },
    context.actionSecret,
    context.now.getTime(),
  );
  return {
    type: action.type,
    label: "تأیید و اجرا",
    summary,
    token: signed.token,
  };
}

function actionDisabledText() {
  return "متن درخواستت را فهمیدم، اما تأیید امن عملیات در سرور هنوز تنظیم نشده است؛ بنابراین هیچ تغییری ذخیره نشد.";
}

export async function runAssistantTool(
  intent: InternalIntent,
  context: AssistantToolContext,
): Promise<AssistantToolResult> {
  const { client, householdId, now } = context;
  const timeZone = ensureTimeZone(context.timeZone);

  switch (intent.intent) {
    case "greeting":
      return {
        intent: intent.intent,
        text: "سلام، خوش آمدی 🌿 من دستیار داخلی خونمونم. می‌توانم اطلاعاتی را که با حسابت دسترسی داری از کارها، تقویم، خرید، برنامه غذایی، قبض‌ها، مدارک، تعمیرات و یادآورها پیدا کنم.",
      };
    case "today_tasks": {
      const tasks = await directTasks(client).list();
      const today = dateKey(now, timeZone);
      const endOfToday = atLocalDate(now, timeZone, true);
      const rows = tasks
        .filter(
          (task) =>
            task.status !== "COMPLETED" &&
            task.status !== "ARCHIVED" &&
            task.due_at !== null &&
            new Date(task.due_at).getTime() <= endOfToday,
        )
        .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
        .slice(0, 12)
        .map(
          (task) =>
            `${task.title}${task.due_at ? ` — ${formatPersianTime(task.due_at)}` : ""}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          `کارهای باز تا پایان امروز (${formatPersianDate(now)})`,
          rows,
          "کاری با موعد امروز یا عقب‌افتاده پیدا نکردم.",
        ),
      };
    }
    case "upcoming_reminders": {
      const reminders = await directReminders(client).list();
      const horizon = now.getTime() + 7 * 86400000;
      const rows = reminders
        .filter(
          (item) =>
            (item.status === "PENDING" || item.status === "SNOOZED") &&
            new Date(item.snoozed_until ?? item.remind_at).getTime() >=
              now.getTime() &&
            new Date(item.snoozed_until ?? item.remind_at).getTime() <= horizon,
        )
        .sort(
          (a, b) =>
            new Date(a.snoozed_until ?? a.remind_at).getTime() -
            new Date(b.snoozed_until ?? b.remind_at).getTime(),
        )
        .slice(0, 10)
        .map(
          (item) =>
            `${item.target_type === "TASK" ? "کار" : item.target_type === "EVENT" ? "رویداد" : item.target_type === "BILL" ? "قبض" : item.target_type === "DOCUMENT" ? "مدرک" : item.target_type === "APPLIANCE" ? "وسیله" : item.target_type === "MEAL" ? "غذا" : "یادآور"} — ${formatPersianDate(item.snoozed_until ?? item.remind_at)}، ${formatPersianTime(item.snoozed_until ?? item.remind_at)}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "یادآورهای هفت روز آینده",
          rows,
          "یادآور بازی در هفت روز آینده نداری.",
        ),
      };
    }
    case "calendar_events": {
      const events = await directCalendar(client).list();
      const horizon = now.getTime() + 30 * 86400000;
      const rows = events
        .filter((event) => {
          const start = new Date(event.start_at).getTime();
          return start >= now.getTime() && start <= horizon;
        })
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .slice(0, 10)
        .map(
          (event) =>
            `${event.title} — ${formatPersianDate(event.start_at)}${event.all_day ? "" : `، ${formatPersianTime(event.start_at)}`}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "رویدادهای ۳۰ روز آینده",
          rows,
          "رویداد آینده‌ای در این بازه پیدا نکردم.",
        ),
      };
    }
    case "shopping_list": {
      if (!householdId)
        return {
          intent: intent.intent,
          text: "برای دیدن لیست خرید مشترک، ابتدا وارد یک خانه شو.",
        };
      const api = directShopping(client);
      const lists = await api.lists(householdId);
      const batches = await Promise.all(
        lists.map(async (list) => ({
          name: list.name,
          items: await api.items(list.id),
        })),
      );
      const rows = batches.flatMap(({ name, items }) =>
        items
          .filter((item) => !item.purchased)
          .slice(0, 20)
          .map(
            (item) =>
              `${item.name}${item.quantity ? ` (${toPersianNumber(Number(item.quantity))}${item.unit ? ` ${item.unit}` : ""})` : ""} — ${name}`,
          ),
      );
      return {
        intent: intent.intent,
        text: sayList(
          "اقلام باقی‌ماندهٔ لیست خرید",
          rows.slice(0, 20),
          "همهٔ لیست‌های خرید فعلی خالی یا انجام‌شده‌اند.",
        ),
      };
    }
    case "meal_plan": {
      if (!householdId)
        return {
          intent: intent.intent,
          text: "برای دیدن برنامه غذایی، ابتدا وارد یک خانه شو.",
        };
      const week = getJalaliWeekRange(now);
      const toDateOnly = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const meals = await directMeals(client).list(
        householdId,
        toDateOnly(week.start),
        toDateOnly(new Date(week.end.getTime() - 86400000)),
      );
      const rows = meals
        .slice(0, 14)
        .map(
          (meal) =>
            `${formatPersianDate(`${meal.meal_date}T12:00:00`)} — ${meal.meal_type === "breakfast" ? "صبحانه" : meal.meal_type === "lunch" ? "ناهار" : "شام"}: ${meal.title}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "برنامهٔ غذایی هفتهٔ جاری",
          rows,
          "برای این هفته برنامهٔ غذایی ثبت نشده است.",
        ),
      };
    }
    case "upcoming_bills": {
      const finance = await directFinance(client).list();
      const horizon = now.getTime() + 45 * 86400000;
      const rows = finance
        .filter(
          (record) =>
            ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(
              record.record_type,
            ) &&
            !record.paid_at &&
            record.due_at &&
            new Date(record.due_at).getTime() <= horizon,
        )
        .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
        .slice(0, 10)
        .map(
          (record) =>
            `${record.title} — ${formatPersianDate(record.due_at!)}، ${toPersianNumber(Number(record.amount))} ${record.currency}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "قبض‌ها و اقساط سررسیدشونده تا ۴۵ روز آینده",
          rows,
          "مورد پرداخت‌نشده‌ای با سررسید در ۴۵ روز آینده پیدا نکردم.",
        ),
      };
    }
    case "expiring_documents": {
      const documents = await directDocuments(client).list();
      const rows = documents
        .filter(
          (document) =>
            document.expires_at &&
            new Date(`${document.expires_at}T23:59:59`).getTime() >=
              now.getTime(),
        )
        .sort((a, b) => (a.expires_at ?? "").localeCompare(b.expires_at ?? ""))
        .slice(0, 10)
        .map(
          (document) =>
            `${document.title} — ${formatPersianDate(`${document.expires_at}T12:00:00`)} (${describeDocumentExpiry(document).label})`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "مدارک دارای تاریخ انقضا",
          rows,
          "مدرک دارای تاریخ انقضای آینده پیدا نکردم.",
        ),
      };
    }
    case "maintenance_schedule": {
      const appliances = await directAppliances(client).list();
      const rows = appliances
        .filter(
          (appliance) =>
            appliance.next_service_at &&
            new Date(appliance.next_service_at).getTime() >= now.getTime(),
        )
        .sort((a, b) =>
          (a.next_service_at ?? "").localeCompare(b.next_service_at ?? ""),
        )
        .slice(0, 10)
        .map(
          (appliance) =>
            `${appliance.name} — ${formatPersianDate(appliance.next_service_at!)}`,
        );
      return {
        intent: intent.intent,
        text: sayList(
          "سرویس‌های برنامه‌ریزی‌شدهٔ وسایل",
          rows,
          "زمان سرویس آینده‌ای برای وسایل ثبت‌شده پیدا نکردم.",
        ),
      };
    }
    case "household_summary": {
      const [tasks, finance, reminders, meals] = await Promise.all([
        directTasks(client).list(),
        directFinance(client).list(),
        directReminders(client).list(),
        householdId
          ? (() => {
              const week = getJalaliWeekRange(now);
              const date = (value: Date) =>
                `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
              return directMeals(client).list(
                householdId,
                date(week.start),
                date(new Date(week.end.getTime() - 86400000)),
              );
            })()
          : Promise.resolve([]),
      ]);
      const today = dateKey(now, timeZone);
      const dueToday = tasks.filter(
        (task) =>
          task.status !== "COMPLETED" &&
          task.due_at &&
          dateKey(new Date(task.due_at), timeZone) === today,
      ).length;
      const dueBills = finance.filter(
        (record) =>
          ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(
            record.record_type,
          ) &&
          !record.paid_at &&
          record.due_at &&
          new Date(record.due_at).getTime() <= now.getTime() + 45 * 86400000,
      ).length;
      const nextReminders = reminders.filter(
        (item) =>
          ["PENDING", "SNOOZED"].includes(item.status) &&
          new Date(item.snoozed_until ?? item.remind_at).getTime() >=
            now.getTime() &&
          new Date(item.snoozed_until ?? item.remind_at).getTime() <=
            now.getTime() + 7 * 86400000,
      ).length;
      return {
        intent: intent.intent,
        text: `خلاصهٔ داده‌های در دسترس حسابت:\n• کارهای دارای موعد امروز: ${toPersianNumber(dueToday)}\n• قبض و قسط پرداخت‌نشده تا ۴۵ روز: ${toPersianNumber(dueBills)}\n• یادآور در هفت روز آینده: ${toPersianNumber(nextReminders)}\n• وعده‌های ثبت‌شده در برنامهٔ این هفته: ${toPersianNumber(meals.length)}${householdId ? "" : "\nبرای اطلاعات مشترک خانه باید عضو یک خانه باشی."}`,
      };
    }
    case "create_household_task": {
      const title = intent.taskTitle?.trim();
      if (!title)
        return {
          intent: intent.intent,
          text: "عنوان کار مشخص نیست. می‌توانی این‌طور بنویسی: «کار جدید: آب دادن گل‌ها».",
        };
      const visibility = canShare(context.message);
      const taskVisibility: "PRIVATE" | "HOUSEHOLD_SHARED" = visibility
        ? "HOUSEHOLD_SHARED"
        : "PRIVATE";
      if (taskVisibility === "HOUSEHOLD_SHARED" && !householdId)
        return {
          intent: intent.intent,
          text: "برای ساخت کار مشترک، ابتدا باید عضو یک خانه باشی.",
        };
      const taskInput = {
        title,
        visibility: taskVisibility,
        priority: "NORMAL" as const,
        status: "PENDING" as const,
        dueAt: null,
        assigneeIds: [context.userId],
        recurrence: { frequency: "NONE" as const },
      };
      if (!context.actionSecret || context.actionSecret.length < 32)
        return { intent: intent.intent, text: actionDisabledText() };
      const proposed = await createProposal(
        { type: "create_household_task", payload: taskInput },
        `${taskVisibility === "PRIVATE" ? "کار شخصی" : "کار مشترک"}: ${title}`,
        context,
      );
      return {
        intent: intent.intent,
        text: "این کار هنوز ذخیره نشده است. جزئیات را بررسی و برای ثبت، تأیید صریح بزن.",
        action: proposed,
      };
    }
    case "add_shopping_item": {
      const name = intent.shoppingItemName?.trim();
      if (!name)
        return {
          intent: intent.intent,
          text: "نام قلم خرید را مشخص نکردی. نمونه: «به لیست خرید اضافه کن: شیر».",
        };
      if (!householdId)
        return {
          intent: intent.intent,
          text: "برای افزودن به لیست خرید خانه، ابتدا باید عضو یک خانه باشی.",
        };
      const lists = await directShopping(client).lists(householdId);
      if (lists.length !== 1)
        return {
          intent: intent.intent,
          text: lists.length
            ? `چند لیست خرید داری (${lists.map((list) => list.name).join("، ")}). از صفحهٔ خرید، لیست موردنظر را انتخاب کن؛ فعلاً چیزی اضافه نکردم.`
            : "لیست خرید فعالی پیدا نکردم؛ ابتدا در بخش خرید یک لیست بساز.",
        };
      if (!context.actionSecret || context.actionSecret.length < 32)
        return { intent: intent.intent, text: actionDisabledText() };
      const payload = { listId: lists[0].id, name };
      const proposed = await createProposal(
        { type: "add_shopping_item", payload },
        `افزودن «${name}» به «${lists[0].name}»`,
        context,
      );
      return {
        intent: intent.intent,
        text: "قلم هنوز به فهرست اضافه نشده است. برای ذخیره، جزئیات را بررسی و تأیید کن.",
        action: proposed,
      };
    }
    case "create_reminder": {
      if (
        !intent.reminderTargetTitle ||
        !intent.reminderTime ||
        !intent.reminderDate
      )
        return {
          intent: intent.intent,
          text: "برای ساخت یادآور، نام دقیق کار یا رویداد و زمان را بنویس؛ نمونه: «یادآور برای خرید نان فردا ساعت ۹:۱۵ تنظیم کن». زمان شمسیِ امروز/فردا پذیرفته می‌شود.",
        };
      const [tasks, events] = await Promise.all([
        directTasks(client).list(),
        directCalendar(client).list(),
      ]);
      const target = normalizePersianText(intent.reminderTargetTitle);
      const matches = [
        ...tasks
          .filter(
            (task) =>
              task.status !== "COMPLETED" &&
              task.status !== "ARCHIVED" &&
              normalizePersianText(task.title) === target,
          )
          .map((task) => ({
            id: task.id,
            type: "TASK" as const,
            title: task.title,
          })),
        ...events
          .filter((event) => normalizePersianText(event.title) === target)
          .map((event) => ({
            id: event.id,
            type: "EVENT" as const,
            title: event.title,
          })),
      ];
      if (matches.length !== 1)
        return {
          intent: intent.intent,
          text: matches.length
            ? "چند کار یا رویداد با این عنوان پیدا شد. عنوان دقیق‌تر را بنویس تا یادآور اشتباهی ساخته نشود."
            : "کار یا رویداد قابل‌دسترسی با این عنوان پیدا نکردم؛ نام دقیق مورد را بررسی کن.",
        };
      let baseDateTime: string;
      try {
        baseDateTime = toLocalDateTimeIso(
          intent.reminderDate,
          intent.reminderTime,
          timeZone,
          now,
        );
      } catch {
        return {
          intent: intent.intent,
          text: "منطقهٔ زمانی یا زمان واردشده معتبر نیست؛ یادآور ساخته نشد.",
        };
      }
      if (new Date(baseDateTime).getTime() <= now.getTime())
        return {
          intent: intent.intent,
          text: "زمان انتخاب‌شده گذشته است؛ برای ساخت یادآور، زمان آینده وارد کن.",
        };
      if (!context.actionSecret || context.actionSecret.length < 32)
        return { intent: intent.intent, text: actionDisabledText() };
      const payload = {
        targetType: matches[0].type,
        targetId: matches[0].id,
        baseDateTime,
        offsets: [{ minutesBefore: 0 }],
        householdId,
      };
      const proposed = await createProposal(
        { type: "create_reminder", payload },
        `یادآور «${matches[0].title}» — ${formatPersianDate(baseDateTime)}، ${formatPersianTime(baseDateTime)}`,
        context,
      );
      return {
        intent: intent.intent,
        text: "یادآور هنوز ساخته نشده است. زمان و عنوان را بررسی و برای ثبت، تأیید کن.",
        action: proposed,
      };
    }
    case "unsupported_inventory":
      return {
        intent: intent.intent,
        text: "در خونمون هنوز اطلاعات موجودی یخچال یا انبار ثبت نمی‌شود؛ مقدار اقلام لیست خرید، موجودی واقعی خانه نیست. برای همین نمی‌توانم موجودی یا کمبود را حدس بزنم.",
      };
    case "unsupported_meal_suggestion":
      return {
        intent: intent.intent,
        text: "می‌توانم برنامهٔ غذایی ثبت‌شده را نشان بدهم، اما هنوز سرویس پیشنهاد غذا یا دستورپخت نداریم؛ نمی‌خواهم پیشنهاد را به‌عنوان دادهٔ خانه جا بزنم.",
      };
    case "unknown":
      return {
        intent: intent.intent,
        text: "این درخواست را در قابلیت‌های فعلی نشناختم. می‌توانی دربارهٔ کارهای امروز، یادآورها، تقویم، خرید، برنامهٔ غذایی ثبت‌شده، قبض‌ها، مدارک یا زمان سرویس وسایل بپرسی.",
      };
  }
}

export async function executeAssistantAction(
  action: AssistantAction,
  requestId: string,
  context: AssistantToolContext,
) {
  switch (action.type) {
    case "create_household_task": {
      if (
        action.payload.visibility === "HOUSEHOLD_SHARED" &&
        !context.householdId
      )
        throw new Error("ACTION_CONTEXT_CHANGED");
      const id = await directTasks(context.client).create(
        action.payload,
        requestId,
      );
      return { id, text: `کار «${action.payload.title}» ثبت شد.` };
    }
    case "add_shopping_item": {
      if (!context.householdId) throw new Error("ACTION_CONTEXT_CHANGED");
      const lists = await directShopping(context.client).lists(
        context.householdId,
      );
      if (!lists.some((list) => list.id === action.payload.listId))
        throw new Error("ACTION_CONTEXT_CHANGED");
      const item = await directShopping(context.client).addItem(
        action.payload,
        requestId,
      );
      return { id: item.id, text: `«${item.name}» به لیست خرید اضافه شد.` };
    }
    case "create_reminder": {
      const target =
        action.payload.targetType === "TASK"
          ? (await directTasks(context.client).list()).some(
              (task) => task.id === action.payload.targetId,
            )
          : (await directCalendar(context.client).list()).some(
              (event) => event.id === action.payload.targetId,
            );
      if (!target) throw new Error("ACTION_CONTEXT_CHANGED");
      await directReminders(context.client).create(action.payload, requestId);
      return { id: requestId, text: "یادآور با زمان انتخاب‌شده ثبت شد." };
    }
  }
}
