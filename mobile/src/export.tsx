import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFileName } from "@/features/export/archive";
import { exportMobileData } from "@/features/export/direct-client";

export function ExportData({ client }: { client: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download(format: "json" | "csv") {
    setBusy(true);
    setMessage("");
    try {
      const now = new Date();
      const text = await exportMobileData(client, format, now);
      const name = exportFileName({ extension: format, now });
      const mime = format === "csv" ? "text/csv" : "application/json";
      if (new TextEncoder().encode(text).length > 8 * 1024 * 1024)
        throw new Error("اندازهٔ خروجی بیش از ۸ مگابایت است.");
      const native = window.KhoonemoonNotifications?.saveExport;
      if (window.KhoonemoonNotifications) {
        if (!native || !native(name, mime, text))
          throw new Error("امکان باز کردن ذخیره‌ساز فایل وجود ندارد.");
        setMessage("محل ذخیره را در پنجرهٔ اندروید انتخاب کنید.");
      } else {
        const url = URL.createObjectURL(
          new Blob([text], { type: `${mime};charset=utf-8` }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMessage("درخواست ذخیرهٔ فایل ارسال شد.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "استخراج داده‌ها ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>خروجی داده‌ها</h2>
      <p>
        خروجی شامل داده‌های قابل‌مشاهدهٔ حسابت است؛ فایل‌های مدارک در آن نیستند.
        آن را در جای امن نگه دارید.
      </p>
      <div className="search-filters">
        <button disabled={busy} onClick={() => void download("json")}>
          دریافت داده‌ها (JSON)
        </button>
        <button
          disabled={busy}
          className="minor"
          onClick={() => void download("csv")}
        >
          دفتر مالی (CSV)
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
