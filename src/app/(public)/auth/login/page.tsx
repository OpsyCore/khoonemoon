import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          در حال آماده‌سازی فرم ورود...
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
