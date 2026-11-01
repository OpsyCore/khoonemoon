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
import {
  encryptBackup,
  decryptBackup,
  isEncryptedBackup,
  MAX_ENCRYPTED_BACKUP,
} from "@/features/export/backup-encryption";
import { saveBackupNative } from "./save-backup";
import { restoreMissing } from "@/features/export/restore-client";

export function ExportData({ client }: { client: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedBytes, setSelectedBytes] = useState<Uint8Array | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState("");
  const [openPassword, setOpenPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [allowHouseholdCopy, setAllowHouseholdCopy] = useState(false);
  async function inspect(file: File | undefined, password?: string) {
    setPreview(null);
    setSelectedBytes(null);
    if (password === undefined) {
      setEncryptedFile(null);
      setOpenPassword("");
    }
    setConfirmed(false);
    setAllowHouseholdCopy(false);
    setMessage("");
    if (!file) return;
    if (file.size > MAX_ENCRYPTED_BACKUP) {
      setMessage("فایل برای بررسی بیش از ۱۶ مگابایت است.");
      return;
    }
    setBusy(true);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      if (isEncryptedBackup(raw) && password === undefined) {
        if (active.current) setEncryptedFile(file);
        return;
      }
      const bytes = isEncryptedBackup(raw)
        ? await decryptBackup(raw, password ?? "")
        : raw;
      const result = await inspectBackup(bytes);
      if (active.current) {
        setPreview(result);
        setSelectedBytes(bytes);
        setEncryptedFile(null);
        setOpenPassword("");
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
    if (!selectedBytes || !confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await restoreMissing(
        client,
        selectedBytes,
        allowHouseholdCopy,
      );
      if (active.current) {
        setMessage(
          `${result.deferred ? "بازیابی کامل نشد." : "بازیابی موارد قابل بازگردانی انجام شد."} ${result.inserted} ردیف اضافه شد، ${result.skipped} ردیف موجود دست‌نخورده ماند و ${result.repairedFiles} فایل گم‌شده برگردانده یا تأیید شد. ${result.householdCopy ? "یک خانهٔ جدید مستقل ساخته شد؛ اعضا باید دوباره دعوت شوند." : ""} ${result.deferred ? `${result.deferred} مورد هنوز باز است؛ تخصیص‌ها به پیوستن دوباره اعضا نیاز دارند و فایل مدارک اعضای دیگر هنوز خودکار بازیابی نمی‌شود.` : ""} فهرست‌ها را تازه کنید.`,
        );
        setConfirmed(false);
      }
    } catch (error) {
      if (active.current)
        setMessage(
          (error instanceof Error
            ? error.message
            : "نتیجه بازیابی تأیید نشد؛ ممکن است فایل موقت باقی مانده باشد.") +
            (allowHouseholdCopy
              ? " اگر ساخت خانه شروع شده باشد، ممکن است خانهٔ جدید باقی مانده باشد؛ وضعیت خانه را بررسی کنید."
              : ""),
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
    if (
      backupPassword.length < 12 ||
      backupPassword !== backupPasswordConfirm
    ) {
      setMessage("رمز باید حداقل ۱۲ نویسه باشد و تکرار آن یکسان باشد.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const now = new Date();
      const zip = await exportMobileBackup(client, now);
      const bytes = await encryptBackup(zip, backupPassword);
      if (!active.current) return;
      setBackupPassword("");
      setBackupPasswordConfirm("");
      const name = `khoonemoon-${now.toISOString().slice(0, 10)}.kbackup`;
      if (window.KhoonemoonNotifications) {
        saveBackupNative(bytes, name);
        setMessage("محل ذخیره را در پنجرهٔ اندروید انتخاب کنید.");
      } else {
        const blob = new Blob([new Uint8Array(bytes)], {
          type: "application/octet-stream",
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
      <p>
        پشتیبان با رمزی که خودتان تعیین می‌کنید روی دستگاه رمزگذاری می‌شود. رمز
        را در جای امن نگه دارید؛ بدون آن بازیابی ممکن نیست. این فایل همچنان
        پشتیبان کامل حساب یا کل پروژه نیست.
      </p>
      <label>
        رمز پشتیبان (حداقل ۱۲ نویسه)
        <input
          type="password"
          autoComplete="new-password"
          maxLength={1024}
          value={backupPassword}
          disabled={busy}
          onChange={(e) => setBackupPassword(e.target.value)}
        />
      </label>
      <label>
        تکرار رمز پشتیبان
        <input
          type="password"
          autoComplete="new-password"
          maxLength={1024}
          value={backupPasswordConfirm}
          disabled={busy}
          onChange={(e) => setBackupPasswordConfirm(e.target.value)}
        />
      </label>
      <div className="search-filters">
        <button disabled={busy} onClick={() => void backup()}>
          ذخیرهٔ پشتیبان رمزگذاری‌شده روی دستگاه
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
          فایل پشتیبان رمزگذاری‌شده یا ZIP قدیمی برنامه را انتخاب کنید؛ فقط روی
          دستگاه بررسی می‌شود و چیزی بازیابی یا بارگذاری نمی‌شود.
        </p>
        <label>
          انتخاب فایل پشتیبان{" "}
          <input
            type="file"
            accept=".kbackup,.zip,application/zip,application/octet-stream"
            disabled={busy}
            onChange={(event) => {
              void inspect(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {encryptedFile && (
          <div>
            <label>
              رمز این پشتیبان
              <input
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={openPassword}
                disabled={busy}
                onChange={(e) => setOpenPassword(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !openPassword}
              onClick={() => void inspect(encryptedFile, openPassword)}
            >
              باز کردن و بررسی
            </button>
          </div>
        )}
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
                    فقط با همان حساب و تا ۵۰٬۰۰۰ ردیف؛ اگر خانهٔ اصلی موجود
                    نیست، ساخت نسخهٔ جدید فقط با تأیید جداگانه ممکن است. دادهٔ
                    مشترک دارای امضای معتبر بازیابی می‌شود، اما تخصیص‌ها تا
                    پیوستن مجدد اعضا و فایل مدارک متعلق به دیگران ممکن است باز
                    بمانند. تاریخچه در نسخه‌های دارای امضای معتبر و دسترسی فعلی
                    بازیابی می‌شود؛ در نسخه‌های قدیمی باید موجود باشد. ردیف‌ها و
                    فایل‌های موجود تغییر نمی‌کنند؛ فایل گم‌شدهٔ مدرک متعلق به
                    شما ممکن است بازگردانده شود. بازیابی کامل حساب یا سایر اعضا
                    نیست. فایل‌ها جداگانه بارگذاری می‌شوند و در صورت خطا ممکن
                    است فایل موقت باقی بماند. مجموع کنترلی اصالت فایل را اثبات
                    نمی‌کند؛ فقط فایل مورداعتماد خودتان را انتخاب کنید.
                  </p>
                  {preview.hasServerSignature && (
                    <label>
                      <input
                        type="checkbox"
                        checked={allowHouseholdCopy}
                        disabled={busy}
                        onChange={(e) =>
                          setAllowHouseholdCopy(e.target.checked)
                        }
                      />{" "}
                      اگر خانهٔ اصلی موجود نیست، با همین حساب یک خانهٔ جدید و
                      مستقل بساز. فقط من مالک می‌شوم؛ اعضای دیگر خودکار
                      برنمی‌گردند و باید دوباره دعوت شوند. در صورت خطا ممکن است
                      خانهٔ جدید باقی بماند.
                    </label>
                  )}
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
