import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: "خونه‌مون",
  description: "سیستم زندگی مشترک برای مدیریت آرام کارهای روزانه زوج‌ها",
  applicationName: "خونه‌مون",
  appleWebApp: {
    capable: true,
    title: "خونه‌مون",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5ebdd" },
    { media: "(prefers-color-scheme: dark)", color: "#211f1a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
