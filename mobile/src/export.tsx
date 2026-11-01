import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFileName } from "@/features/export/archive";
import {
  exportMobileBackup,
  exportMobileData,
} from "@/features/export/direct-client";
import {
  inspectBackup,
  type BackupPreview,
} from "@/features/export/backup-integrity";
import { saveBackupNative } from "./save-backup";

export function ExportData({ client }: { client: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  async function inspect(file: File | undefined) {
    setPreview(null);
    setMessage("");
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      setMessage("فایل برای بررسی بیش از ۱۶ مگابایت است.");
      return;
    }
    setBusy(true);
    try {
      const result = await inspectBackup(
        new Uint8Array(await file.arrayBuffer()),
      );
      if (active.current) setPreview(result);
    } catch (error) {
      if (active.current)
        setMessage(
          error instanceof Error ? error.message : "بررسی فایل ناموفق بود.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function download(format: "json" | "csv") {
    setBusy(true);
    setMessage("");
    try {
      const now = new Date();
      const text = await exportMobileData(client, format, now);
      if (!active.current) return;
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
      if (active.current) setBusy(false);
    }
  }
  async function backup() {
    setBusy(true);
    setMessage("");
    try {
      const now = new Date();
      const bytes = await exportMobileBackup(client, now);
      if (!active.current) return;
      const name = `khoonemoon-${now.toISOString().slice(0, 10)}.zip`;
      if (window.KhoonemoonNotifications) {
        saveBackupNative(bytes, name);
        setMessage("محل ذخیره را در پنجرهٔ اندروید انتخاب کنید.");
      } else {
        const blob = new Blob([new Uint8Array(bytes)], {
          type: "application/zip",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMessage("درخواست ذخیرهٔ فایل ارسال شد.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ساخت پشتیبان ناموفق بود.",
      );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section>
      <h2>خروجی داده‌ها</h2>
      <p>
        خروجی ZIP شامل داده‌های قابل مشاهده و فایل‌های مدارک است (حداکثر ۲۰۰
        فایل و ۱۲ مگابایت فایل). JSON و CSV فایل مدارک ندارند. این خروجی‌ها نسخه
        پشتیبان کامل نیستند، شامل همه اطلاعات حساب و خانه نمی‌شوند و بازیابی
        خودکار ندارند. داده‌های JSON و ZIP از یک لحظهٔ پایگاه داده هستند، اما
        فایل‌های مدارک جداگانه خوانده می‌شوند؛ CSV نیز صفحه‌بندی می‌شود. فایل را
        در جای امن نگه دارید.
      </p>
      <div className="search-filters">
        <button disabled={busy} onClick={() => void backup()}>
          خروجی داده و فایل مدارک (ZIP)
        </button>
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
      <details>
        <summary>بررسی فایل خروجی ذخیره‌شده</summary>
        <p>
          فایل ZIP ساخته‌شده توسط برنامه را انتخاب کنید؛ فقط روی دستگاه بررسی
          می‌شود و چیزی بازیابی یا بارگذاری نمی‌شود.
        </p>
        <label>
          انتخاب فایل ZIP{" "}
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(event) => {
              void inspect(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {preview && (
          <div role="status">
            <p>
              تاریخ خروجی:{" "}
              {new Date(preview.exportedAt).toLocaleDateString("fa-IR")} ·{" "}
              {preview.tableCount} بخش داده · {preview.rowCount} ردیف ·{" "}
              {preview.documents} فایل مدرک
            </p>
            <p>
              {preview.integrity === "verified"
                ? "یکپارچگی محتوا با SHA-256 بررسی شد؛ این بررسی اصالت فایل یا کامل بودن نسخه را تضمین نمی‌کند."
                : "نسخه قدیمی بدون مجموع کنترلی است؛ یکپارچگی محتوای آن قابل تأیید نیست."}
            </p>
            <p>
              این بررسی بازیابی داده نیست و خروجی همچنان گزیده است؛ فایل‌ها جدا
              از داده‌ها خوانده می‌شوند.
            </p>
          </div>
        )}
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
