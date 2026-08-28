import Link from "next/link";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

export function AccountSettingsCard({ email }: { email: string | null }) {
  return (
    <Card className="space-y-3">
      <CardTitle>حساب</CardTitle>
      <CardDescription>
        ایمیل حساب شما از طریق احراز هویت فعلی خوانده می‌شود.
      </CardDescription>
      <p className="break-all text-sm text-zinc-800 dark:text-zinc-100">
        {email || "ایمیل در دسترس نیست."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/profile"
          className="inline-flex h-9 items-center justify-center rounded-2xl bg-sky-600 px-3 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          ویرایش پروفایل
        </Link>
        <LogoutButton showLabel />
      </div>
    </Card>
  );
}
