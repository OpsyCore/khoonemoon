import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد."),
  timezone: z
    .string()
    .trim()
    .min(1, "منطقه زمانی را انتخاب کنید.")
    .max(80)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return /^utc$/i.test(zone) || zone.includes("/");
      } catch {
        return false;
      }
    }, "منطقه زمانی معتبر وارد کنید؛ مثلاً Asia/Tehran.")
    .transform(
      (zone) =>
        new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions()
          .timeZone,
    ),
  locale: z
    .string()
    .trim()
    .min(1, "زبان پیش‌فرض را انتخاب کنید.")
    .max(40)
    .refine((value) => {
      try {
        return Intl.getCanonicalLocales(value).length === 1;
      } catch {
        return false;
      }
    }, "کد زبان معتبر وارد کنید؛ مثلاً fa-IR.")
    .transform((value) => Intl.getCanonicalLocales(value)[0]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
