import { z } from "zod";

export const choreFrequencySchema = z.enum([
  "NONE",
  "DAILY",
  "INTERVAL_DAYS",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const rotationModeSchema = z.enum(["FIXED", "ROTATING"]);

export const createChoreSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "عنوان کار خانه باید حداقل ۲ کاراکتر باشد.")
      .max(180, "عنوان کار خانه بیش از حد طولانی است."),
    description: z.string().trim().max(2000).optional(),
    rotationMode: rotationModeSchema.default("FIXED"),
    assigneeIds: z.array(z.string().uuid()).max(10).default([]),
    frequency: choreFrequencySchema.default("WEEKLY"),
    intervalDays: z.number().int().min(1).max(365).optional().nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
    nextDueAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "INTERVAL_DAYS" && !value.intervalDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervalDays"],
        message: "برای تکرار روزشمار، بازه روزها را مشخص کنید.",
      });
    }

    if (value.rotationMode === "ROTATING" && value.assigneeIds.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeIds"],
        message: "برای چرخش، حداقل دو نفر لازم است.",
      });
    }
  });

export const updateChoreSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  frequency: choreFrequencySchema.optional(),
  intervalDays: z.number().int().min(1).max(365).nullable().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  nextDueAt: z.string().datetime().nullable().optional(),
  rotationMode: rotationModeSchema.optional(),
  assigneeIds: z.array(z.string().uuid()).max(10).optional(),
});

export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
