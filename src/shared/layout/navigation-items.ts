import {
  Bell,
  CalendarDays,
  FileText,
  House,
  ListTodo,
  ReceiptText,
  Search,
  Settings,
  SunMedium,
  UserRound,
  Wallet,
} from "lucide-react";

/** Shared destinations; each shell retains its own router and platform behavior. */
export const primaryNavigation = [
  { id: "house", href: "/home", label: "خانه", icon: House },
  { id: "tasks", href: "/today", label: "امروز", icon: SunMedium },
  { id: "calendar", href: "/calendar", label: "تقویم", icon: CalendarDays },
  { id: "shopping", href: "/lists", label: "لیست‌ها", icon: ListTodo },
  { id: "finance", href: "/finance", label: "مالی", icon: Wallet },
] as const;
export const secondaryNavigation = [
  { id: "bills", href: "/bills", label: "قبوض و خدمات", icon: ReceiptText },
  { id: "chores", href: "/chores", label: "تقسیم وظایف", icon: House },
  { id: "search", href: "/search", label: "جستجو", icon: Search },
  { id: "documents", href: "/documents", label: "مدارک", icon: FileText },
  { id: "reminders", href: "/reminders", label: "یادآورها", icon: Bell },
  { id: "profile", href: "/profile", label: "حساب کاربری", icon: UserRound },
  { id: "settings", href: "/settings", label: "تنظیمات", icon: Settings },
] as const;
