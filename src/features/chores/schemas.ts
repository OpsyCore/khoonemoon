import { z } from "zod";
import { CHORE_FREQUENCIES } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const choreDateSchema = z
  .string()
  .regex(datePattern, "تاریخ باید با فرمت YYYY-MM-DD باشد");

export const choreFrequencySchema = z.enum(CHORE_FREQUENCIES);

export const choreRecurrenceSchema = z
  .object({
    frequency: choreFrequencySchema,
    intervalDays: z.number().int().positive().nullable().optional(),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.frequency === "INTERVAL_DAYS" &&
      !value.intervalDays
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "فاصله روزها الزامی است",
      });
    }

    if (
      value.frequency === "WEEKLY" &&
      (!value.weekdays || value.weekdays.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "حداقل یک روز هفته انتخاب کنید",
      });
    }

    if (
      value.weekdays &&
      new Set(value.weekdays).size !== value.weekdays.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "روزهای هفته نباید تکراری باشند",
      });
    }
  });

export const createChoreSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان کار الزامی است")
    .max(120, "عنوان کار بیش از حد طولانی است"),

  description: z
    .string()
    .trim()
    .max(1000, "توضیحات بیش از حد طولانی است")
    .nullable()
    .optional(),

  startDate: choreDateSchema,

  defaultAssigneeId: z.uuid().nullable().optional(),

  recurrence: choreRecurrenceSchema,

  rotationUserIds: z
    .array(z.uuid())
    .max(20)
    .default([])
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "اعضای چرخش نباید تکراری باشند",
    ),
});

export const updateChoreSchema = createChoreSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const completeChoreSchema = z.object({
  forDate: choreDateSchema,
});

export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
export type CompleteChoreInput = z.infer<typeof completeChoreSchema>;
