import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
        {children}
      </section>
    </main>
  );
}
