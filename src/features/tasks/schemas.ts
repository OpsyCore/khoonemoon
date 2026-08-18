import { z } from "zod";

const statusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "ARCHIVED",
]);

const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const visibilitySchema = z.enum(["PRIVATE", "HOUSEHOLD_SHARED"]);

const recurrenceSchema = z.object({
  frequency: z.enum([
    "NONE",
    "DAILY",
    "INTERVAL_DAYS",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
  ]),
  intervalDays: z.number().int().min(1).max(365).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
});

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "عنوان تسک باید حداقل ۲ کاراکتر باشد.")
      .max(180, "عنوان تسک نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد."),
    description: z
      .string()
      .trim()
      .max(2000, "توضیحات بیش از حد طولانی است.")
      .optional(),
    visibility: visibilitySchema,
    priority: prioritySchema,
    status: statusSchema,
    dueAt: z.string().datetime().optional().nullable(),
    assigneeIds: z.array(z.string().uuid()),
    recurrence: recurrenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.visibility === "PRIVATE" && value.assigneeIds.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeIds"],
        message: "برای تسک خصوصی فقط یک مسئول مجاز است.",
      });
    }

    if (
      value.recurrence.frequency === "INTERVAL_DAYS" &&
      !value.recurrence.intervalDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence", "intervalDays"],
        message: "برای تکرار فاصله‌ای باید تعداد روز مشخص شود.",
      });
    }

    if (
      value.recurrence.frequency === "WEEKLY" &&
      !value.recurrence.weekdays?.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence", "weekdays"],
        message: "حداقل یک روز هفته را برای تکرار انتخاب کنید.",
      });
    }
  });

export const updateTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
});

export const patchTaskSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("reschedule"), dueAt: z.string().datetime() }),
  z.object({ action: z.literal("update"), data: createTaskSchema }),
]);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;
