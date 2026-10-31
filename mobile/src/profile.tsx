import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { directProfile } from "@/features/profile/direct-client";

export function Profile({ client }: { client: SupabaseClient }) {
  const api = useMemo(() => directProfile(client), [client]);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void api
      .get()
      .then((profile) => {
        if (!alive) return;
        setName(profile.full_name);
        setTimezone(profile.timezone);
        setLocale(profile.locale);
        setReady(true);
      })
      .catch(() => {
        if (alive) setMessage("دریافت پروفایل ناموفق بود.");
      });
    return () => {
      alive = false;
    };
  }, [api]);
  function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    void api
      .update({ full_name: name, timezone, locale })
      .then(() => setMessage("پروفایل ذخیره شد."))
      .catch(() => setMessage("ذخیره پروفایل ناموفق بود."))
      .finally(() => setBusy(false));
  }
  return (
    <section>
      <h2>پروفایل</h2>
      {message && <p role="status">{message}</p>}
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
            />
          </label>
          <label>
            زبان
            <input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              required
            />
          </label>
          <button disabled={busy}>ذخیره پروفایل</button>
        </form>
      )}
    </section>
  );
}
