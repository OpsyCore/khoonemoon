import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "./globals.css";

const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  display: "swap",
  variable: "--font-vazirmatn",
  weight: "100 900",
});

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
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-[var(--font-vazirmatn)] antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
