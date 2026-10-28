import { z } from "zod";

export const financialRecordTypeSchema = z.enum([
  "EXPENSE",
  "INCOME",
  "BILL",
  "SUBSCRIPTION",
  "INSTALLMENT",
  "DEBT",
]);

export const financialVisibilitySchema = z.enum([
  "PRIVATE",
  "HOUSEHOLD_SHARED",
]);

const amountSchema = z
  .number({ message: "مبلغ را به عدد وارد کنید." })
  .min(0, "مبلغ نمی‌تواند منفی باشد.")
  .max(1_000_000_000_000, "مبلغ بیش از حد بزرگ است.");

export const createFinancialRecordSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "عنوان باید حداقل ۲ کاراکتر باشد.")
      .max(180, "عنوان بیش از حد طولانی است."),
    recordType: financialRecordTypeSchema,
    visibility: financialVisibilitySchema.default("HOUSEHOLD_SHARED"),
    amount: amountSchema,
    currency: z.string().trim().length(3).default("IRR"),
    category: z.string().trim().max(60).optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
    occurredAt: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    isRecurring: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const needsDueDate = ["BILL", "SUBSCRIPTION", "INSTALLMENT"].includes(
      value.recordType,
    );

    if (needsDueDate && !value.dueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueAt"],
        message: "برای قبض/اقساط، تاریخ سررسید الزامی است.",
      });
    }
  });

export const updateFinancialRecordSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  amount: amountSchema.optional(),
  category: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  paid: z.boolean().optional(),
});

export type CreateFinancialRecordInput = z.infer<
  typeof createFinancialRecordSchema
>;
