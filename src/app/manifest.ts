import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "خونه‌مون",
    short_name: "خونه‌مون",
    description: "سیستم زندگی مشترک برای مدیریت آرام کارهای روزانه زوج‌ها",
    start_url: "/today",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#9aa06e",
    lang: "fa-IR",
    dir: "rtl",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
