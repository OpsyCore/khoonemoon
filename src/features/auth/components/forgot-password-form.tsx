"use client";
import { useState, type FormEvent } from "react";
import { openSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPersianAuthErrorMessage } from "@/features/auth/error-messages";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { RecoveryReference } from "./recovery-reference";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "ایمیل معتبر وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const opened = openSupabaseBrowserClient();
      if ("error" in opened) {
        setMessage(opened.error);
        return;
      }
      const { error } = await opened.client.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/update-password`,
        },
      );
      if (error) {
        setMessage(getPersianAuthErrorMessage(error));
        return;
      }
      setMessage(
        "اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود. پیوند را در همین مرورگر باز کنید.",
      );
    } catch (error) {
      setMessage(getPersianAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RecoveryReference
      email={email}
      setEmail={setEmail}
      busy={busy}
      onSubmit={(event) => void submit(event)}
      backHref="/auth/login"
      message={message}
    />
  );
}
