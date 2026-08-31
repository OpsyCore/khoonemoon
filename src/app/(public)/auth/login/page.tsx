import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-ink-soft">در حال آماده‌سازی فرم ورود...</p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
