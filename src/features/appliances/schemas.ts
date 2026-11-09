import { z } from "zod";

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ معتبر نیست.");

export const createApplianceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "نام وسیله باید حداقل ۲ کاراکتر باشد.")
      .max(180, "نام وسیله بیش از حد طولانی است."),
    visibility: z.enum(["PRIVATE", "HOUSEHOLD_SHARED"]),
    applianceGroup: z.enum(["APPLIANCE", "SYSTEM", "VEHICLE", "OTHER"]),
    brand: z.string().trim().max(120).nullable().optional(),
    model: z.string().trim().max(120).nullable().optional(),
    serialNumber: z.string().trim().max(120).nullable().optional(),
    purchasedOn: ymdSchema.nullable().optional(),
    warrantyUntil: ymdSchema.nullable().optional(),
    lastServiceOn: ymdSchema.nullable().optional(),
    nextServiceAt: z.string().datetime().nullable().optional(),
    serviceIntervalDays: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .nullable()
      .optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.purchasedOn && v.warrantyUntil && v.warrantyUntil < v.purchasedOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warrantyUntil"],
        message: "پایان گارانتی نمی‌تواند قبل از تاریخ خرید باشد.",
      });
    }
  });

export const recordMaintenanceSchema = z.object({
  applianceId: z.string().uuid(),
  kind: z.enum(["SERVICE", "REPAIR", "INSPECTION"]),
  title: z
    .string()
    .trim()
    .min(2, "شرح سرویس یا تعمیر باید حداقل ۲ کاراکتر باشد.")
    .max(180),
  performedOn: ymdSchema.optional(),
  costAmount: z.number().int().min(0).nullable().optional(),
  recordInFinance: z.boolean().optional(),
  financialRecordId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  technicianName: z.string().trim().max(140).nullable().optional(),
  technicianContact: z.string().trim().max(140).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  nextServiceAt: z.string().datetime().nullable().optional(),
  reminderOffsetsMinutes: z
    .array(z.number().int().min(0).max(43200))
    .max(6)
    .optional(),
});

export type CreateApplianceInput = z.infer<typeof createApplianceSchema>;
export type RecordMaintenanceInput = z.infer<typeof recordMaintenanceSchema>;
