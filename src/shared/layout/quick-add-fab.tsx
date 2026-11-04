"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { QuickAddSheet } from "@/features/quick-add/components/quick-add-sheet";
import { cn } from "@/shared/utils/cn";

export function QuickAddFab({ hasHousehold }: { hasHousehold: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 left-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[var(--app-primary)] text-white shadow-lg shadow-[var(--app-primary)]/30 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] dark:text-[#211f1a]",
          "md:bottom-6 md:right-6 md:left-auto",
        )}
        aria-label="افزودن سریع"
        aria-haspopup="dialog"
      >
        <Plus className="size-6" />
      </button>

      {/* Mounting only while open gives every session a clean form state and
          keeps the dialog out of the accessibility tree when closed. */}
      {isOpen ? (
        <QuickAddSheet
          onClose={() => setIsOpen(false)}
          hasHousehold={hasHousehold}
        />
      ) : null}
    </>
  );
}
