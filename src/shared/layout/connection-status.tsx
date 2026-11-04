"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { OfflineScreen } from "@/shared/ui/offline-screen";
import { probeConnection } from "@/shared/utils/connection-probe";
import "../../../public/offline-screen.css";

export function ConnectionStatus({
  offlineOnly = false,
}: {
  offlineOnly?: boolean;
}) {
  // Initial server and client markup must match; synchronize after hydration.
  const [online, setOnline] = useState(true),
    [dismissed, setDismissed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const update = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (!connected) setDismissed(false);
      else setMessage("");
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  async function retry() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const connected = await probeConnection(
      `/api/__connection?ts=${Date.now()}`,
    );
    setBusy(false);
    if (connected) {
      setOnline(true);
      setDismissed(false);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } else setMessage("اتصال به سرور برقرار نشد؛ دوباره امتحان کنید.");
  }
  if (online) return offlineOnly ? null : <Badge tone="success">آنلاین</Badge>;
  if (dismissed)
    return (
      <button
        type="button"
        className="offline-badge"
        onClick={() => setDismissed(false)}
      >
        آفلاین
      </button>
    );
  return (
    <div
      className="offline-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-title"
    >
      <OfflineScreen
        message={message}
        actions={
          <>
            <button
              className="offline-retry"
              disabled={busy}
              onClick={() => void retry()}
            >
              {busy ? "در حال بررسی…" : "تلاش مجدد"}
            </button>
            <a
              className="offline-back"
              href="/today"
              onClick={(e) => {
                if (window.location.pathname === "/today") {
                  e.preventDefault();
                  setDismissed(true);
                } else if (
                  !window.confirm(
                    "برای بازگشت به امروز ممکن است تغییرات ذخیره‌نشده از دست بروند. ادامه می‌دهید؟",
                  )
                )
                  e.preventDefault();
              }}
            >
              بازگشت به امروز
            </a>
          </>
        }
      />
    </div>
  );
}
