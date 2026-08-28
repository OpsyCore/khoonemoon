import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";

const shortcuts = [
  { href: "/home", label: "خانه و اعضا" },
  { href: "/search", label: "جستجو" },
  { href: "/profile", label: "پروفایل" },
  { href: "/offline", label: "صفحه آفلاین" },
] as const;

export function SettingsShortcutsCard() {
  return (
    <Card className="space-y-3">
      <CardTitle>میانبرها</CardTitle>
      <CardDescription>
        این لینک‌ها به صفحات موجود می‌روند و مسیر موازی نمی‌سازند.
      </CardDescription>
      <ul className="flex flex-wrap gap-2">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-flex h-9 items-center rounded-2xl border border-zinc-200 px-3 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
