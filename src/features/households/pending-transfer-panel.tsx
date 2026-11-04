"use client";
import { useEffect, useState } from "react";
import {
  importPendingTransferCode,
  listPendingTransferCodes,
} from "@/lib/mutations/pending-create";
import {
  exportPendingInvitation,
  importPendingInvitation,
} from "./pending-invitation";

const labels: Record<string, string> = {
  task: "کار",
  chore: "کار خانه",
  calendar: "رویداد",
  finance: "مالی",
  "shopping-item": "کالای خرید",
  "shopping-list": "لیست خرید",
  document: "مدرک",
  reminders: "یادآور",
};
type Item = { kind: string; code: string };
/** Manual transfer avoids silently merging two independently intended creates. */
export function PendingTransferPanel({
  userId,
  householdId,
}: {
  userId: string;
  householdId: string | null;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function refresh() {
    try {
      const items = listPendingTransferCodes(userId);
      const invite = householdId
        ? exportPendingInvitation(userId, householdId)
        : null;
      if (invite) items.push({ kind: "invitation", code: invite });
      setItems(items);
    } catch {
      setMessage("خواندن درخواست‌های ذخیره‌شده ممکن نیست.");
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const items = listPendingTransferCodes(userId);
        const invite = householdId
          ? exportPendingInvitation(userId, householdId)
          : null;
        if (invite) items.push({ kind: "invitation", code: invite });
        setItems(items);
      } catch {
        setMessage("خواندن درخواست‌های ذخیره‌شده ممکن نیست.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, householdId]);
  async function apply() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const code = input.trim();
      if (code.startsWith("KHI1.")) {
        if (!householdId)
          throw new Error(
            "برای انتقال دعوت باید در همان خانه و حساب وارد شوید.",
          );
        await importPendingInvitation(userId, householdId, code);
      } else await importPendingTransferCode(userId, code);
      setInput("");
      refresh();
      setMessage(
        "کد ثبت شد. اکنون در همین حساب همان اطلاعات و همان فایل را دوباره ارسال کنید؛ برای دعوت دوباره دکمه ساخت دعوت را بزنید.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "کد ثبت نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3" aria-label="انتقال درخواست نامشخص">
      <h2>انتقال درخواست نامشخص</h2>
      <p>
        اگر نتیجه ثبت به‌دلیل قطع شبکه مشخص نشد، کد درخواست را به دستگاه دیگر
        خودتان منتقل کنید. فقط در همان حساب و با همان اطلاعات دوباره تلاش کنید؛
        ثبت‌های مستقل ادغام نمی‌شوند.
      </p>
      <p>
        کد را فقط برای نتیجه نامشخص و فقط از دستگاه مطمئن خودتان استفاده کنید.
        بعد از تأیید یا حذف عمدی داده، کد قدیمی را دوباره استفاده نکنید.
      </p>
      <p>
        کد دعوت حاوی خود دعوت است؛ آن را فقط به دستگاه مطمئن خودتان منتقل کنید و
        عمومی نفرستید.
      </p>
      <button type="button" onClick={refresh}>
        تازه‌سازی درخواست‌ها
      </button>
      {items.length === 0 ? (
        <p>درخواست نامشخصی در این دستگاه پیدا نشد.</p>
      ) : (
        items.map((item) => (
          <div key={item.code}>
            <p>
              {item.kind === "invitation"
                ? "دعوت‌نامه (محرمانه)"
                : (labels[item.kind] ?? "درخواست")}
            </p>
            <textarea
              aria-label={`کد انتقال ${labels[item.kind] ?? item.kind}`}
              dir="ltr"
              readOnly
              value={item.code}
              rows={3}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard?.writeText) {
                  setMessage("کد را انتخاب و دستی کپی کنید.");
                  return;
                }
                void navigator.clipboard
                  .writeText(item.code)
                  .then(() => setMessage("کد کپی شد."))
                  .catch(() => setMessage("کد را انتخاب و دستی کپی کنید."));
              }}
            >
              کپی کد
            </button>
          </div>
        ))
      )}
      <label>
        کد دستگاه دیگر
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          dir="ltr"
          rows={3}
          maxLength={1500}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        disabled={busy || !input.trim()}
        onClick={() => void apply()}
      >
        ثبت کد انتقال
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
