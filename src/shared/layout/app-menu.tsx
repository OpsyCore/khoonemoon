"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { secondaryNavigation } from "@/shared/layout/navigation-items";
import { describeBadge, formatBadgeCount } from "@/shared/utils/badge-count";

export function AppMenu({
  dueReminderCount = 0,
}: {
  dueReminderCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const badge = formatBadgeCount(dueReminderCount);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);
  return (
    <div className="app-shell-menu">
      <button
        ref={trigger}
        type="button"
        aria-label={
          badge
            ? `باز کردن منو، ${describeBadge(dueReminderCount)}`
            : "باز کردن منو"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className="app-shell-menu-trigger"
        onClick={() => setOpen(true)}
      >
        <Menu size={21} strokeWidth={1.7} aria-hidden="true" />
        {badge && (
          <span aria-hidden="true" className="app-shell-menu-badge">
            {badge}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="app-shell-drawer"
        aria-labelledby="web-menu-title"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="app-shell-drawer-head">
          <div>
            <span className="app-shell-drawer-eyebrow">KHOONEMOON</span>
            <h2 id="web-menu-title">بخش‌های دیگر</h2>
          </div>
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p>همه چیز برای زندگی کوچک ما</p>
        <nav aria-label="بخش‌های دیگر برنامه">
          {secondaryNavigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              <span className="app-shell-drawer-icon">
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span>{label}</span>
              {href === "/reminders" && badge && (
                <span
                  className="app-shell-menu-count"
                  aria-label={describeBadge(dueReminderCount)}
                >
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </dialog>
    </div>
  );
}
