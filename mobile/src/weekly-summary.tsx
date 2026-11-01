import { spendingComparison } from "./weekly-comparison";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  getMobileWeeklySummary,
  type MobileWeeklySummary,
} from "@/features/summary/direct-client";
import { formatAmount } from "@/features/finance/bills";

export function WeeklySummary({ client }: { client: SupabaseClient }) {
  const [summary, setSummary] = useState<MobileWeeklySummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener("khoonemoon:schedule-changed", reload);
    return () =>
      window.removeEventListener("khoonemoon:schedule-changed", reload);
  }, [reload]);
  useEffect(() => {
    let active = true;
    void getMobileWeeklySummary(client, new Date())
      .then((data) => {
        if (active) {
          setSummary(data);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setSummary(null);
          setError("خلاصهٔ هفتگی دریافت نشد.");
        }
      });
    return () => {
      active = false;
    };
  }, [client, refresh]);
  return (
    <section>
      <h2>این هفته</h2>
      <p>
        مقایسهٔ هفت روز گذشته با هفت روز قبل از آن؛ کارهای انجام‌شده حتی پس از
        بایگانی در تعداد لحاظ می‌شوند.
      </p>
      {error && <p role="alert">{error}</p>}
      {!summary && !error && <p>در حال دریافت…</p>}
      {summary && (
        <>
          <p>
            کارهای انجام‌شده: {summary.counts.tasksDone} · هفتهٔ قبل:{" "}
            {summary.counts.tasksDonePrevious}
          </p>
          <p>
            کار خانه: {summary.counts.choresDone} · هفتهٔ قبل:{" "}
            {summary.counts.choresDonePrevious}
          </p>
          {summary.currencies.map(({ currency, summary: s }) => (
            <p key={currency}>
              خرج {currency}: {formatAmount(s.spent, currency)} · هفتهٔ قبل:{" "}
              {formatAmount(s.spentPrevious, currency)} · درآمد:{" "}
              {formatAmount(s.earned, currency)} ·{" "}
              {spendingComparison(s.spentChange)}
            </p>
          ))}
        </>
      )}
      <button className="minor" onClick={reload}>
        تازه‌سازی خلاصه
      </button>
    </section>
  );
}
