import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directFinance } from "@/features/finance/direct-client";
import type {
  FinancialRecord,
  FinancialRecordType,
} from "@/features/finance/types";
import {
  isBillRecord,
  getBillStatus,
  formatAmount,
  summarizeFinance,
} from "@/features/finance/bills";
import { buildFinanceAnalytics } from "@/features/finance/analytics";
import {
  filterLedger,
  DEFAULT_LEDGER_FILTERS,
  TYPE_LABELS,
  type LedgerType,
  type PaidFilter,
  type LedgerDays,
} from "@/features/finance/ledger";
import { settleHousehold } from "@/features/finance/settlement";
import { parseAmount } from "@/shared/utils/amount";

const billTypes = new Set(["BILL", "SUBSCRIPTION", "INSTALLMENT"]);
const statusLabel = {
  PAID: "پرداخت‌شده",
  UPCOMING: "پیش‌رو",
  DUE: "نزدیک سررسید",
  OVERDUE: "معوق",
} as const;
function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function Finance({
  client,
  householdId,
}: {
  client: SupabaseClient;
  householdId: string | null;
}) {
  const api = useMemo(() => directFinance(client), [client]);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [membersReady, setMembersReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState(
    "همگام‌سازی زنده بررسی نشده است؛ تازه‌سازی دستی در دسترس است.",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<FinancialRecord | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<FinancialRecordType>("EXPENSE");
  const [shared, setShared] = useState(false);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [occurred, setOccurred] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [currency, setCurrency] = useState("IRR");
  const [recordCurrency, setRecordCurrency] = useState("IRR");
  const [filters, setFilters] = useState(DEFAULT_LEDGER_FILTERS);
  const load = useCallback(async () => {
    const data = await api.list();
    setRecords(data);
    setLoaded(true);
  }, [api]);
  useEffect(() => {
    let alive = true;
    void api
      .list()
      .then((data) => {
        if (alive) {
          setRecords(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setMessage("دریافت اطلاعات مالی ناموفق بود.");
      });
    // Reload authorized rows rather than trusting realtime payloads, including deletes.
    const channel = client
      .channel(`mobile-finance-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_records" },
        () => {
          void api
            .list()
            .then((data) => {
              if (alive) setRecords(data);
            })
            .catch(() => {
              if (alive) setMessage("همگام‌سازی مالی ناموفق بود.");
            });
        },
      )
      .subscribe((status) => {
        if (alive)
          setSync(
            status === "SUBSCRIBED"
              ? "اتصال زنده برقرار است؛ تازه‌سازی دوره‌ای نیز فعال است."
              : "اتصال زنده در دسترس نیست؛ از تازه‌سازی استفاده کنید.",
          );
      });
    const refresh = () => {
      if (document.visibilityState === "visible")
        void api
          .list()
          .then((data) => {
            if (alive) setRecords(data);
          })
          .catch(() => {
            if (alive) {
              setRecords([]);
              setLoaded(false);
              setMessage("تازه‌سازی اطلاعات مالی ناموفق بود.");
            }
          });
    };
    const interval = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      void client.removeChannel(channel);
    };
  }, [api, client]);
  useEffect(() => {
    let alive = true;
    if (!householdId) return;
    const refreshMembers = () => {
      void Promise.all([
        client
          .from("household_members")
          .select("user_id")
          .eq("household_id", householdId)
          .is("left_at", null)
          .order("joined_at"),
        client.rpc("household_member_names", {
          target_household_id: householdId,
        }),
      ])
        .then(([membership, names]) => {
          if (!alive) return;
          if (membership.error || names.error || !membership.data?.length) {
            setMembersReady(false);
            setMessage("دریافت اعضا برای تسویه ناموفق بود.");
            return;
          }
          const map = new Map(
            (
              (names.data ?? []) as { id: string; full_name: string | null }[]
            ).map((m) => [m.id, m.full_name]),
          );
          setMembers(
            membership.data.map((m) => ({
              id: m.user_id,
              name: map.get(m.user_id) || "کاربر",
            })),
          );
          setMembersReady(true);
        })
        .catch(() => {
          if (alive) {
            setMembersReady(false);
            setMessage("دریافت اعضا برای تسویه ناموفق بود.");
          }
        });
    };
    refreshMembers();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshMembers();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(onVisible, 60000);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, householdId]);
  const now = new Date();
  // Do not add different currencies together. The current form records IRR only.
  const money = useMemo(
    () => records.filter((record) => record.currency === currency),
    [records, currency],
  );
  const summary = summarizeFinance(money, now);
  const analytics = buildFinanceAnalytics({ records: money, now });
  const ledger = filterLedger({ records: money, filters, now });
  const settlement = useMemo(
    () =>
      settleHousehold({
        records: money.filter((record) => record.household_id === householdId),
        members,
      }),
    [money, members, householdId],
  );
  function reset() {
    setEditing(null);
    setRecordCurrency("IRR");
    setTitle("");
    setAmount("");
    setKind("EXPENSE");
    setShared(false);
    setCategory("");
    setNote("");
    setDue("");
    setOccurred("");
    setRecurring(false);
  }
  function beginEdit(record: FinancialRecord) {
    setEditing(record);
    setRecordCurrency(record.currency);
    setTitle(record.title);
    setAmount(String(record.amount));
    setKind(record.record_type);
    setShared(record.visibility === "HOUSEHOLD_SHARED");
    setCategory(record.category ?? "");
    setNote(record.note ?? "");
    setDue(localInput(record.due_at));
    setOccurred(localInput(record.occurred_at));
    setRecurring(record.is_recurring);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const value = parseAmount(amount);
      if (value === null) throw new Error("مبلغ معتبر وارد کنید.");
      const dueAt = due ? new Date(due).toISOString() : null;
      if (billTypes.has(kind) && !dueAt)
        throw new Error("تاریخ سررسید قبض یا قسط لازم است.");
      if (editing)
        await api.update(editing.id, {
          title,
          amount: value,
          category: category || null,
          note: note || null,
          dueAt,
        });
      else
        await api.create({
          title,
          amount: value,
          recordType: kind,
          visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
          currency: recordCurrency,
          category: category || null,
          note: note || null,
          dueAt,
          occurredAt: occurred ? new Date(occurred).toISOString() : null,
          isRecurring: recurring,
        });
      reset();
      try {
        await load();
      } catch {
        setMessage(
          "ثبت انجام شد؛ تازه‌سازی اطلاعات ناموفق بود. دوباره تازه‌سازی کنید.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ثبت اطلاعات مالی ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function paid(record: FinancialRecord) {
    setBusy(true);
    setMessage("");
    try {
      await api.update(record.id, { paid: !record.paid_at });
      await load();
    } catch {
      setMessage("تغییر وضعیت پرداخت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function archive(record: FinancialRecord) {
    if (!window.confirm("این مورد مالی بایگانی شود؟")) return;
    setBusy(true);
    setMessage("");
    try {
      await api.archive(record.id);
      await load();
      if (editing?.id === record.id) reset();
    } catch {
      setMessage("بایگانی مورد مالی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>مالی و قبض‌ها</h2>
      <p>{sync}</p>
      <button
        type="button"
        className="minor"
        onClick={() =>
          void load().catch(() => {
            setRecords([]);
            setLoaded(false);
            setMessage("تازه‌سازی ناموفق بود.");
          })
        }
      >
        تازه‌سازی مالی
      </button>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <form onSubmit={(e) => void save(e)}>
        <h3>{editing ? "ویرایش مورد مالی" : "ثبت مورد مالی"}</h3>
        <label>
          عنوان
          <input
            required
            minLength={2}
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          نوع
          <select
            disabled={Boolean(editing)}
            value={kind}
            onChange={(e) => setKind(e.target.value as FinancialRecordType)}
          >
            {Object.entries(TYPE_LABELS)
              .filter(([key]) => key !== "ALL")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          مبلغ ({recordCurrency === "IRR" ? "تومان" : recordCurrency})
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          ارز{" "}
          <select
            value={recordCurrency}
            disabled={Boolean(editing)}
            onChange={(e) => setRecordCurrency(e.target.value)}
          >
            <option value="IRR">تومان</option>
            <option value="USD">دلار آمریکا</option>
            <option value="EUR">یورو</option>
            <option value="TRY">لیر ترکیه</option>
            {!["IRR", "USD", "EUR", "TRY"].includes(recordCurrency) && (
              <option value={recordCurrency}>{recordCurrency}</option>
            )}
          </select>
        </label>
        <label>
          دسته‌بندی
          <input
            maxLength={60}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label>
          یادداشت
          <input
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label>
          سررسید
          <input
            type="datetime-local"
            required={billTypes.has(kind)}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        {!editing && (
          <label>
            تاریخ ثبت
            <input
              type="datetime-local"
              value={occurred}
              onChange={(e) => setOccurred(e.target.value)}
            />
          </label>
        )}
        {!editing && householdId && (
          <label className="item">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            مشترک با خانه
          </label>
        )}
        {!editing && (
          <label className="item">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            علامت‌گذاری به‌عنوان تکرارشونده
          </label>
        )}
        {recurring && (
          <small>این علامت به‌تنهایی مورد بعدی را خودکار ایجاد نمی‌کند.</small>
        )}
        <button disabled={busy}>{editing ? "ذخیره تغییرات" : "ثبت"}</button>
        {editing && (
          <button type="button" className="minor" onClick={reset}>
            انصراف
          </button>
        )}
      </form>
      {loaded && (
        <>
          <label>
            ارز گزارش و دفتر
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {Array.from(
                new Set(["IRR", ...records.map((record) => record.currency)]),
              ).map((code) => (
                <option key={code} value={code}>
                  {code === "IRR" ? "تومان" : code}
                </option>
              ))}
            </select>
          </label>
          <p>مبالغ فقط برای ارز انتخاب‌شده محاسبه می‌شوند.</p>
          <h3>خلاصه مالی</h3>
          <p>
            درآمد: {formatAmount(summary.income, currency)} · هزینه:{" "}
            {formatAmount(summary.expense, currency)} · قبض‌های پرداخت‌نشده:{" "}
            {formatAmount(summary.outstanding, currency)}
          </p>
          <p>
            معوق: {summary.overdueCount} · نزدیک سررسید: {summary.dueSoonCount}
          </p>
          <h3>گزارش شش‌ماهه</h3>
          <p>
            گزارش شامل قبض‌های پرداخت‌نشده هم هست و تاریخ پرداخت، سپس سررسید و
            در نهایت تاریخ ثبت را ملاک می‌گیرد.
          </p>
          <ul>
            {analytics.months.map((month) => (
              <li key={month.key}>
                {month.label} — درآمد {formatAmount(month.income, currency)} ·
                هزینه {formatAmount(month.expense, currency)}
              </li>
            ))}
          </ul>
          <h3>دسته‌بندی هزینه‌ها</h3>
          {analytics.categories.length ? (
            <ul>
              {analytics.categories.map((item) => (
                <li key={item.category}>
                  {item.category} — {formatAmount(item.total, currency)} (
                  {item.share}٪)
                </li>
              ))}
            </ul>
          ) : (
            <p>اطلاعاتی در این بازه وجود ندارد.</p>
          )}
          {householdId && membersReady && (
            <>
              <h3>برآورد تسویه مشترک</h3>
              <p>تقسیم برابر بین اعضای فعلی، نه ثبت پرداخت واقعی.</p>
              {settlement.transfers.length ? (
                <ul>
                  {settlement.transfers.map((transfer) => (
                    <li key={`${transfer.fromId}-${transfer.toId}`}>
                      {transfer.fromName} به {transfer.toName}:{" "}
                      {formatAmount(transfer.amount, currency)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>تسویه‌ای محاسبه نشد.</p>
              )}
            </>
          )}
          <h3>دفتر مالی</h3>
          <label>
            جست‌وجو
            <input
              value={filters.query}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value })
              }
            />
          </label>
          <label>
            نوع
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters({ ...filters, type: e.target.value as LedgerType })
              }
            >
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            پرداخت
            <select
              value={filters.paid}
              onChange={(e) =>
                setFilters({ ...filters, paid: e.target.value as PaidFilter })
              }
            >
              <option value="ALL">همه</option>
              <option value="PAID">پرداخت‌شده</option>
              <option value="UNPAID">پرداخت‌نشده</option>
            </select>
          </label>
          <label>
            بازه
            <select
              value={filters.days}
              onChange={(e) =>
                setFilters({ ...filters, days: e.target.value as LedgerDays })
              }
            >
              <option value="ALL">همه</option>
              <option value="30">۳۰ روز</option>
              <option value="90">۹۰ روز</option>
              <option value="365">یک سال</option>
            </select>
          </label>
          <p>{ledger.summary.count} مورد</p>
          <ul>
            {ledger.records.map((record) => (
              <li key={record.id}>
                <div>
                  <strong>{record.title}</strong>
                  <p>
                    {TYPE_LABELS[record.record_type]} ·{" "}
                    {formatAmount(record.amount, record.currency)}{" "}
                    {isBillRecord(record) &&
                      `· ${statusLabel[getBillStatus({ dueAt: record.due_at, paidAt: record.paid_at, now })]}`}
                  </p>
                  <small>
                    {record.visibility === "PRIVATE" ? "شخصی" : "مشترک"}
                  </small>
                </div>
                <div>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => beginEdit(record)}
                  >
                    ویرایش
                  </button>
                  {isBillRecord(record) && (
                    <button
                      className="minor"
                      disabled={busy}
                      onClick={() => void paid(record)}
                    >
                      {record.paid_at ? "بازگرداندن پرداخت" : "پرداخت شد"}
                    </button>
                  )}
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => void archive(record)}
                  >
                    بایگانی
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
