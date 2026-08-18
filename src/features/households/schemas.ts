import { z } from "zod";

export const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام خانه باید حداقل ۲ کاراکتر باشد.")
    .max(80, "نام خانه نمی‌تواند بیشتر از ۸۰ کاراکتر باشد."),
});

export const joinHouseholdSchema = z.object({
  code: z
    .string()
    .trim()
    .min(12, "کد دعوت معتبر نیست.")
    .max(128, "کد دعوت معتبر نیست."),
});

export const updateHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام خانه باید حداقل ۲ کاراکتر باشد.")
    .max(80, "نام خانه نمی‌تواند بیشتر از ۸۰ کاراکتر باشد."),
});

export const cancelInvitationSchema = z.object({
  invitationId: z.string().uuid("شناسه دعوت معتبر نیست."),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type JoinHouseholdInput = z.infer<typeof joinHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>;
