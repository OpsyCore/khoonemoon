import Link from "next/link";
import { Mail, UserRound } from "lucide-react";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Card, CardTitle } from "@/shared/ui/card";

export function AccountSettingsCard({ email }: { email: string | null }) {
  return (
    <Card className="space-y-1 p-5">
      <CardTitle>حساب</CardTitle>
      <div className="divide-y divide-line">
        <div className="flex items-center gap-3 py-3.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
            <Mail className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted">ایمیل</p>
            <p className="break-all text-sm text-ink">
              {email || "ایمیل در دسترس نیست."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3.5">
          <Link
            href="/profile"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-paper px-4 text-[13px] font-medium text-ink transition hover:bg-sunken"
          >
            <UserRound className="size-3.5" strokeWidth={1.75} />
            ویرایش پروفایل
          </Link>
          <LogoutButton showLabel />
        </div>
      </div>
    </Card>
  );
}
