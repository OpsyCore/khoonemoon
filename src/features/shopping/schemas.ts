import { z } from "zod";

export const createShoppingListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام لیست باید حداقل ۲ کاراکتر باشد.")
    .max(120, "نام لیست بیش از حد طولانی است."),
});

export const createShoppingItemSchema = z.object({
  listId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "نام آیتم را وارد کنید.")
    .max(160, "نام آیتم بیش از حد طولانی است."),
  quantity: z.number().positive().max(100000).optional().nullable(),
  unit: z.string().trim().max(24).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const updateShoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.string().trim().max(24).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  purchased: z.boolean().optional(),
});

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>;
