import { z } from "zod";

const recordTypeSchema = z.enum(["BILL", "EXPENSE"]);
const visibilitySchema = z.enum(["PRIVATE", "HOUSEHOLD_SHARED"]);

const amountSchema = z
  .number()
  .finite()
  .positive("مبلغ باید بزرگ‌تر از صفر باشد.")
  .max(999999999999.99, "مبلغ بیش از حد زیاد است.");

const currencySchema = z
  .string()
  .trim()
  .min(3, "واحد پول معتبر نیست.")
  .max(8, "واحد پول معتبر نیست.");

const datetimeSchema = z.string().datetime("تاریخ معتبر نیست.");

const titleSchema = z
  .string()
  .trim()
  .min(1, "عنوان الزامی است.")
  .max(180, "عنوان نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد.");

const categorySchema = z
  .string()
  .trim()
  .min(1, "دسته‌بندی نمی‌تواند خالی باشد.")
  .max(80, "دسته‌بندی نمی‌تواند بیشتر از ۸۰ کاراکتر باشد.")
  .nullable();

const noteSchema = z
  .string()
  .trim()
  .max(1000, "یادداشت نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.")
  .nullable();

function refineBillExpenseDates(
  value: { dueAt?: string | null; occurredAt?: string | null },
  ctx: z.RefinementCtx,
) {
  const hasDue = value.dueAt != null;
  const hasOccurred = value.occurredAt != null;

  if (hasDue && hasOccurred) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["occurredAt"],
      message:
        "قبض و هزینه نمی‌توانند هم‌زمان تاریخ سررسید و وقوع داشته باشند.",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueAt"],
      message:
        "قبض و هزینه نمی‌توانند هم‌زمان تاریخ سررسید و وقوع داشته باشند.",
    });
  }
}

export const createFinanceRecordSchema = z
  .object({
    recordType: recordTypeSchema,
    title: titleSchema,
    amount: amountSchema,
    currency: currencySchema.default("IRR"),
    visibility: visibilitySchema,
    dueAt: datetimeSchema.optional().nullable(),
    occurredAt: datetimeSchema.optional().nullable(),
    category: categorySchema.optional(),
    note: noteSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.recordType === "BILL") {
      if (!value.dueAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueAt"],
          message: "برای قبض، تاریخ سررسید الزامی است.",
        });
      }
      if (value.occurredAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["occurredAt"],
          message: "قبض نباید تاریخ وقوع هزینه داشته باشد.",
        });
      }
    }

    if (value.recordType === "EXPENSE") {
      if (!value.occurredAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["occurredAt"],
          message: "برای هزینه، تاریخ وقوع الزامی است.",
        });
      }
      if (value.dueAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueAt"],
          message: "هزینه یک‌باره نباید تاریخ سررسید داشته باشد.",
        });
      }
    }
  });

export const updateFinanceRecordSchema = z
  .object({
    title: titleSchema.optional(),
    amount: amountSchema.optional(),
    currency: currencySchema.optional(),
    dueAt: datetimeSchema.optional().nullable(),
    occurredAt: datetimeSchema.optional().nullable(),
    category: categorySchema.optional(),
    note: noteSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.amount !== undefined ||
      value.currency !== undefined ||
      value.dueAt !== undefined ||
      value.occurredAt !== undefined ||
      value.category !== undefined ||
      value.note !== undefined,
    { message: "حداقل یک تغییر لازم است." },
  )
  .superRefine((value, ctx) => {
    refineBillExpenseDates(value, ctx);
  });

export const payFinanceRecordSchema = z
  .object({
    paidBy: z.uuid().optional().nullable(),
  })
  .strict();

export const unpayFinanceRecordSchema = z.object({}).strict();

export const patchFinanceRecordSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    data: updateFinanceRecordSchema,
  }),
  z
    .object({
      action: z.literal("pay"),
      paidBy: z.uuid().optional().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("unpay"),
    })
    .strict(),
]);

export type CreateFinanceRecordInput = z.infer<
  typeof createFinanceRecordSchema
>;
export type UpdateFinanceRecordInput = z.infer<
  typeof updateFinanceRecordSchema
>;
export type PayFinanceRecordInput = z.infer<typeof payFinanceRecordSchema>;
export type UnpayFinanceRecordInput = z.infer<typeof unpayFinanceRecordSchema>;
export type PatchFinanceRecordInput = z.infer<typeof patchFinanceRecordSchema>;
