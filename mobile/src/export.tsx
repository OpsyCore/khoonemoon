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
import { restoreMissing } from "@/features/export/restore-client";

export function ExportData({ client }: { client: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function inspect(file: File | undefined) {
    setPreview(null);
    setSelectedFile(null);
    setConfirmed(false);
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
      if (active.current) {
        setPreview(result);
        setSelectedFile(file);
      }
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
  async function restore() {
    if (!selectedFile || !confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await restoreMissing(
        client,
        new Uint8Array(await selectedFile.arrayBuffer()),
      );
      if (active.current) {
        setMessage(
          `بازیابی انجام شد: ${result.inserted} ردیف اضافه شد و ${result.skipped} ردیف موجود دست‌نخورده ماند و ${result.repairedFiles} فایل گم‌شده برگردانده یا نسخهٔ یکسان آن تأیید شد. فهرست‌ها را تازه کنید.`,
        );
        setConfirmed(false);
      }
    } catch (error) {
      if (active.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "نتیجه بازیابی تأیید نشد؛ ممکن است فایل موقت باقی مانده باشد.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
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
        کامل حساب ندارند. داده‌های JSON و ZIP از یک لحظهٔ پایگاه داده هستند، اما
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
            {preview.hasServerSignature && (
              <p>
                اطلاعات خروجی امضای سرور دارد؛ اصالت آن هنگام بازیابی بررسی
                می‌شود. امضا فایل‌های مدارک را پوشش نمی‌دهد.
              </p>
            )}
            <p>
              این بررسی بازیابی داده نیست و خروجی همچنان گزیده است؛ فایل‌ها جدا
              از داده‌ها خوانده می‌شوند.
            </p>
            {preview.integrity === "verified" &&
              preview.tableCount === 19 &&
              preview.rowCount <= 50000 && (
                <div>
                  <h3>بازیابی محدود داده‌های حذف‌شده</h3>
                  <p>
                    فقط با همان حساب و تا ۵۰٬۰۰۰ ردیف؛ خانه و عضویت باید همچنان
                    موجود باشند. تاریخچه در نسخه‌های دارای امضای معتبر و دسترسی
                    فعلی بازیابی می‌شود؛ در نسخه‌های قدیمی باید موجود باشد.
                    ردیف‌ها و فایل‌های موجود تغییر نمی‌کنند؛ فایل گم‌شدهٔ مدرک
                    متعلق به شما ممکن است بازگردانده شود. بازیابی کامل حساب یا
                    سایر اعضا نیست. فایل‌ها جداگانه بارگذاری می‌شوند و در صورت
                    خطا ممکن است فایل موقت باقی بماند. مجموع کنترلی اصالت فایل
                    را اثبات نمی‌کند؛ فقط فایل مورداعتماد خودتان را انتخاب کنید.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{" "}
                    محدودیت‌ها را خوانده‌ام و می‌خواهم ردیف‌های حذف‌شده را اضافه
                    کنم.
                  </label>
                  <button
                    disabled={busy || !confirmed}
                    onClick={() => void restore()}
                  >
                    بازیابی محدود
                  </button>
                </div>
              )}
            {(preview.tableCount !== 19 ||
              preview.rowCount > 50000 ||
              preview.integrity !== "verified") && (
              <p>این فایل شرایط بازیابی محدود را ندارد؛ فقط قابل بررسی است.</p>
            )}
          </div>
        )}
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
