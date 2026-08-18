import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد."),
  email: z.string().trim().email("ایمیل معتبر وارد کنید."),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("ایمیل معتبر وارد کنید."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("ایمیل معتبر وارد کنید."),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد."),
    confirmPassword: z
      .string()
      .min(8, "تکرار رمز عبور باید حداقل ۸ کاراکتر باشد."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "تکرار رمز عبور با رمز عبور یکسان نیست.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
