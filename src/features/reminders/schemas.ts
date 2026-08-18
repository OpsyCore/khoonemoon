import { z } from "zod";

export const reminderOffsetSchema = z.object({
  minutesBefore: z
    .number()
    .int()
    .min(0, "مقدار یادآور باید صفر یا بیشتر باشد.")
    .max(60 * 24 * 30, "مقدار یادآور بیش از حد زیاد است."),
});

export const createRemindersSchema = z.object({
  targetType: z.enum(["TASK", "EVENT"]),
  targetId: z.string().uuid("شناسه هدف معتبر نیست."),
  baseDateTime: z.string().datetime("تاریخ/زمان مبنا معتبر نیست."),
  offsets: z
    .array(reminderOffsetSchema)
    .min(1, "حداقل یک یادآور لازم است.")
    .max(10, "حداکثر ۱۰ یادآور قابل ثبت است."),
  householdId: z.string().uuid().nullable().optional(),
});

export const snoozeReminderSchema = z.object({
  reminderId: z.string().uuid("شناسه یادآور معتبر نیست."),
  minutes: z
    .number()
    .int()
    .min(1, "مدت تعویق باید حداقل یک دقیقه باشد.")
    .max(24 * 60, "مدت تعویق نمی‌تواند بیش از ۲۴ ساعت باشد."),
});

export const cancelReminderSchema = z.object({
  reminderId: z.string().uuid("شناسه یادآور معتبر نیست."),
});

export const reminderPreferencesSchema = z
  .object({
    inAppEnabled: z.boolean(),
    webPushEnabled: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.quietHoursEnabled &&
      (!value.quietHoursStart || !value.quietHoursEnd)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quietHoursStart"],
        message: "برای ساعات سکوت، بازه زمانی شروع و پایان لازم است.",
      });
    }
  });

export type CreateRemindersInput = z.infer<typeof createRemindersSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;
export type ReminderPreferencesInput = z.infer<
  typeof reminderPreferencesSchema
>;
