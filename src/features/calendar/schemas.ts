import { z } from "zod";

const visibilitySchema = z.enum(["PRIVATE", "HOUSEHOLD_SHARED"]);

export const createEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "عنوان رویداد باید حداقل ۲ کاراکتر باشد.")
      .max(180, "عنوان رویداد نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد."),
    description: z
      .string()
      .trim()
      .max(2000, "توضیحات بیش از حد طولانی است.")
      .optional(),
    visibility: visibilitySchema,
    startAt: z.string().datetime("زمان شروع معتبر نیست."),
    endAt: z.string().datetime("زمان پایان معتبر نیست."),
    allDay: z.boolean(),
    location: z
      .string()
      .trim()
      .max(300, "محل بیش از حد طولانی است.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endAt).getTime() <= new Date(value.startAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "زمان پایان باید بعد از زمان شروع باشد.",
      });
    }
  });

export const updateEventSchema = createEventSchema.extend({
  id: z.string().uuid(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
