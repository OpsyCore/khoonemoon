import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { directProfile } from "@/features/profile/direct-client";
import { ZodError } from "zod";

export function Profile({ client }: { client: SupabaseClient }) {
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
    <section>
      <h2>پروفایل</h2>
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
        <form onSubmit={save}>
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
          <button disabled={busy}>ذخیره پروفایل</button>
        </form>
      )}
    </section>
  );
}
