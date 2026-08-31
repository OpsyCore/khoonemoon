import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  House,
  Search,
  UserRound,
  WifiOff,
} from "lucide-react";
import { Card } from "@/shared/ui/card";

const shortcuts = [
  { href: "/home", label: "خانه و اعضا", icon: House },
  { href: "/documents", label: "مدارک", icon: FileText },
  { href: "/search", label: "جستجو", icon: Search },
  { href: "/profile", label: "پروفایل", icon: UserRound },
  { href: "/offline", label: "صفحه آفلاین", icon: WifiOff },
] as const;

export function SettingsShortcutsCard() {
  return (
    <Card className="p-5">
      <ul className="divide-y divide-line">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 py-3 transition"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft transition group-hover:bg-olive-soft group-hover:text-olive-ink">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-sm text-ink">{item.label}</span>
                <ChevronLeft
                  className="size-4 text-faint transition group-hover:text-ink-soft"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
