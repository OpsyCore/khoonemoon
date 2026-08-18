import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد."),
  timezone: z.string().trim().min(1, "منطقه زمانی را انتخاب کنید."),
  locale: z.string().trim().min(1, "زبان پیش‌فرض را انتخاب کنید."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
