import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import {
  primaryNavigation,
  secondaryNavigation,
} from "@/shared/layout/navigation-items";
import { describeBadge, formatBadgeCount } from "@/shared/utils/badge-count";

export type MobilePage =
  | "house"
  | "tasks"
  | "chores"
  | "task-new"
  | "event-new"
  | "calendar"
  | "shopping"
  | "finance"
  | "bills"
  | "meals"
  | "appliances"
  | "profile"
  | "settings"
  | "reminders"
  | "documents"
  | "search";
export function MobileNavigation({
  page,
  onNavigate,
  dueCount,
}: {
  page: MobilePage;
  onNavigate: (page: MobilePage) => void;
  dueCount: number;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const badge = formatBadgeCount(dueCount);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  function select(target: MobilePage) {
    setOpen(false);
    onNavigate(target);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="menu-trigger"
        aria-label={
          dueCount ? `باز کردن منو، ${describeBadge(dueCount)}` : "باز کردن منو"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} strokeWidth={1.7} aria-hidden="true" />
        {badge && (
          <span className="menu-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="app-menu"
        aria-labelledby="app-menu-title"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="app-menu-header">
          <div>
            <span className="app-menu-eyebrow">KHOONEMOON</span>
            <h2 id="app-menu-title">بخش‌های دیگر</h2>
          </div>
          <button
            type="button"
            className="menu-close"
            aria-label="بستن منو"
            onClick={() => setOpen(false)}
          >
            <X size={20} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
        <p className="app-menu-description">همه چیز برای زندگی کوچک ما</p>
        <nav aria-label="بخش‌های دیگر برنامه" className="app-menu-links">
          {secondaryNavigation.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => select(id)}
            >
              <span className="app-menu-icon">
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span>{label}</span>
              {id === "reminders" && badge && (
                <span
                  className="app-menu-count"
                  aria-label={describeBadge(dueCount)}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </dialog>
      <nav className="bottom-nav" aria-label="بخش‌های اصلی برنامه">
        {primaryNavigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? "page" : undefined}
            onClick={() => select(id)}
          >
            <span className="nav-icon">
              <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
