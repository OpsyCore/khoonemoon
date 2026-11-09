import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { directProfile } from "@/features/profile/direct-client";
import { ZodError } from "zod";
import { FileText, House, Search, Settings } from "lucide-react";
import type { MobilePage } from "./navigation";
import "./profile.css";

export function Profile({
  client,
  email,
  onNavigate,
}: {
  client: SupabaseClient;
  email?: string;
  onNavigate: (page: MobilePage) => void;
}) {
  const api = useMemo(() => directProfile(client), [client]);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void api
      .get()
      .then((profile) => {
        if (!alive) return;
        setName(profile.full_name ?? "");
        setTimezone(profile.timezone ?? "Asia/Tehran");
        setLocale(profile.locale ?? "fa-IR");
        setLoadFailed(false);
        setMessage("");
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setLoadFailed(true);
          setMessage("دریافت پروفایل ناموفق بود؛ اتصال را بررسی کنید.");
        }
      });
    return () => {
      alive = false;
    };
  }, [api, attempt]);
  function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    void api
      .update({ full_name: name, timezone, locale })
      .then(() => setMessage("پروفایل ذخیره شد."))
      .catch((error: unknown) =>
        setMessage(
          error instanceof ZodError
            ? (error.issues[0]?.message ?? "اطلاعات معتبر وارد کنید.")
            : "ذخیره پروفایل ناموفق بود.",
        ),
      )
      .finally(() => setBusy(false));
  }
  return (
    <section className="profile-ref" dir="rtl">
      <header className="profile-ref-header">
        <div>
          <h2>پروفایل</h2>
          <p>حساب شما در دفترچه‌ی مشترک.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-label="تنظیمات"
        >
          <Settings size={20} />
        </button>
      </header>
      <div className="profile-ref-identity">
        <span aria-hidden="true" className="profile-ref-avatar">
          {(name.trim() || email || "؟").slice(0, 1)}
        </span>
        <strong>{ready ? name.trim() || "بدون نام" : "پروفایل"}</strong>
        {email && <small dir="ltr">{email}</small>}
      </div>
      <h3>خانه و تنظیمات</h3>
      <nav className="profile-ref-links" aria-label="خانه و تنظیمات">
        {(
          [
            { page: "house", label: "خانه و اعضا", Icon: House },
            { page: "documents", label: "مدارک خانه", Icon: FileText },
            { page: "settings", label: "تنظیمات و اعلان‌ها", Icon: Settings },
            { page: "search", label: "جستجو", Icon: Search },
          ] as const
        ).map(({ page, label, Icon }) => (
          <button key={page} type="button" onClick={() => onNavigate(page)}>
            <span>
              <Icon size={18} />
            </span>
            {label}
            <b aria-hidden="true">‹</b>
          </button>
        ))}
      </nav>
      <h3>ویرایش پروفایل</h3>
      {message && <p role="status">{message}</p>}
      {!ready && !loadFailed && <p role="status">در حال دریافت پروفایل…</p>}
      {!ready && loadFailed && (
        <button
          type="button"
          className="minor"
          onClick={() => {
            setLoadFailed(false);
            setMessage("");
            setAttempt((n) => n + 1);
          }}
        >
          تلاش دوباره
        </button>
      )}
      {ready && (
        <form onSubmit={save} className="profile-ref-form">
          <label>
            نام
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              required
            />
          </label>
          <label>
            منطقه زمانی
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
              dir="ltr"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Asia/Tehran"
            />
            <small>برای نمونه Asia/Tehran یا Europe/Istanbul</small>
          </label>
          <label>
            زبان
            <input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              dir="ltr"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="fa-IR"
              required
            />
          </label>
          <button disabled={busy}>ذخیره تغییرات</button>
        </form>
      )}
    </section>
  );
}
