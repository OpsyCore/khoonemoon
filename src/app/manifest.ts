import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "خونه‌مون",
    short_name: "خونه‌مون",
    description: "سیستم زندگی مشترک برای مدیریت آرام کارهای روزانه زوج‌ها",
    start_url: "/today",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#0ea5e9",
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
