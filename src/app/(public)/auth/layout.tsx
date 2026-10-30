import type { ReactNode } from "react";
import { BranchDecor, TapeStrip } from "@/shared/ui/decor";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-paper px-4 py-10">
      {/* quiet botanical corners */}
      <BranchDecor className="pointer-events-none absolute -left-4 top-8 h-20 w-40 -scale-x-100 opacity-30" />
      <BranchDecor className="pointer-events-none absolute -right-6 bottom-10 h-24 w-48 rotate-180 opacity-20" />

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[32px] font-bold leading-tight text-ink">
            خونه‌مون
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            دفترچه زندگی مشترک‌مون
          </p>
        </div>

        <section className="relative rounded-card border border-line bg-card p-6 shadow-paper md:p-7">
          <TapeStrip className="absolute -top-3 left-1/2 -translate-x-1/2" />
          {children}
        </section>

        <p className="mt-6 text-center text-[11px] text-faint">
          فضای خصوصی و آرام برای زندگی دونفره
        </p>
      </div>
    </main>
  );
}
