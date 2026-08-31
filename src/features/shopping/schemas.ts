import { z } from "zod";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || null);

export const createShoppingListSchema = z.object({
  name: z.string().trim().min(1, "نام لیست الزامی است.").max(120),
});

export const updateShoppingListSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "حداقل یک تغییر لازم است.",
  });

export const createShoppingItemSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().trim().min(1, "نام کالا الزامی است.").max(180),
  quantity: z.number().positive().max(99999999).optional().nullable(),
  unit: nullableText(40),
  note: nullableText(1000),
});

export const updateShoppingItemSchema = z
  .object({
    name: z.string().trim().min(1).max(180).optional(),
    quantity: z.number().positive().max(99999999).optional().nullable(),
    unit: nullableText(40),
    note: nullableText(1000),
    isChecked: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "حداقل یک تغییر لازم است.",
  });

export type CreateShoppingListInput = z.infer<typeof createShoppingListSchema>;
export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
