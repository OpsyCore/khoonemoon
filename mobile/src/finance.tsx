import { ArrowLeft, Settings } from "lucide-react";
import { FinanceOverview } from "./finance-overview";
import { ledgerCurrency, ledgerFromUrl, ledgerUrl } from "./ledger-url";
import { financeCorrection, financePatchLabels } from "./finance-correction";
import { FinanceChart } from "./finance-chart";
import { taskEditTime } from "./task-edit-time";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  TYPE_LABELS,
  type LedgerType,
  type PaidFilter,
  type LedgerDays,
} from "@/features/finance/ledger";
import {
  settleHousehold,
  excludedSettlementRecords,
} from "@/features/finance/settlement";
import { ZodError } from "zod";
import { parseAmount } from "@/shared/utils/amount";
import { formatPersianDate } from "@/shared/utils/locale";

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
  initialUrl,
  onSettings,
  onBack,
}: {
  client: SupabaseClient;
  householdId: string | null;
  initialUrl?: string;
  onSettings?: () => void;
  onBack?: () => void;
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
  const [formOpen, setFormOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(() => {
    const url = new URL(
      initialUrl ??
        (typeof window === "undefined"
          ? "https://local.invalid"
          : window.location.href),
    );
    return [
      "ledger_category",
      "ledger_type",
      "ledger_paid",
      "ledger_days",
      "ledger_q",
    ].some((key) => url.searchParams.has(key));
  });
  const formRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (formOpen)
      formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [formOpen, editing]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<FinancialRecordType>("EXPENSE");
  const [shared, setShared] = useState(false);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [occurred, setOccurred] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<
    "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
  >("MONTHLY");
  const [currency, setCurrency] = useState(() =>
    ledgerCurrency(
      new URL(
        initialUrl ??
          (typeof window === "undefined"
            ? "https://local.invalid"
            : window.location.href),
      ),
    ),
  );
  const [recordCurrency, setRecordCurrency] = useState("IRR");
  const [filters, setFilters] = useState(() =>
    ledgerFromUrl(
      new URL(
        initialUrl ??
          (typeof window === "undefined"
            ? "https://local.invalid"
            : window.location.href),
      ),
    ),
  );
  const [categoryFilter, setCategoryFilter] = useState(() =>
    (
      new URL(
        initialUrl ??
          (typeof window === "undefined"
            ? "https://local.invalid"
            : window.location.href),
      ).searchParams.get("ledger_category") ?? ""
    ).slice(0, 60),
  );
  function updateFilters(
    next: typeof filters,
    selectedCategory = categoryFilter,
  ) {
    setFilters(next);
    setCategoryFilter(selectedCategory);
    try {
      const url = ledgerUrl(new URL(window.location.href), next, currency);
      if (selectedCategory)
        url.searchParams.set("ledger_category", selectedCategory);
      else url.searchParams.delete("ledger_category");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* link persistence is optional */
    }
  }
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
  // Never add different currencies together.
  const money = useMemo(
    () => records.filter((record) => record.currency === currency),
    [records, currency],
  );
  const summary = summarizeFinance(money, now);
  const analytics = buildFinanceAnalytics({ records: money, now });
  const ledger = filterLedger({
    records: categoryFilter
      ? money.filter(
          (record) => (record.category ?? "").trim() === categoryFilter,
        )
      : money,
    filters,
    now,
  });
  const settlement = useMemo(
    () =>
      settleHousehold({
        records: money.filter(
          (record) =>
            record.household_id === householdId &&
            record.record_type !== "DEBT",
        ),
        members,
      }),
    [money, members, householdId],
  );
  let correctionPreview: string[] = [];
  if (editing) {
    try {
      correctionPreview = Object.keys(
        financeCorrection(editing, { title, amount, category, note, due }),
      ).map(
        (key) => financePatchLabels[key as keyof typeof financePatchLabels],
      );
    } catch {
      /* Form validation is reported on submit. */
    }
  }
  function reset() {
    setFormOpen(false);
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
    setFormOpen(true);
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
      const dueAt = taskEditTime(
        due,
        editing?.due_at ?? null,
        null,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ).dueAt;
      if (billTypes.has(kind) && !dueAt)
        throw new Error("تاریخ سررسید قبض یا قسط لازم است.");
      if (editing) {
        const patch = financeCorrection(editing, {
          title,
          amount,
          category,
          note,
          due,
        });
        if (!Object.keys(patch).length)
          throw new Error("تغییری برای ذخیره وجود ندارد.");
        await api.update(editing.id, patch, editing.updated_at);
      } else
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
          recurrenceRule: recurring ? recurrenceRule : null,
          recurrenceTimezone: recurring
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null,
        });
      reset();
      try {
        await load();
      } catch {
        setRecords([]);
        setLoaded(false);
        setMessage(
          "ثبت انجام شد؛ تازه‌سازی اطلاعات ناموفق بود. دوباره تازه‌سازی کنید.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof ZodError
          ? "اطلاعات مالی معتبر نیست؛ عنوان، مبلغ و سایر فیلدها را بررسی کنید."
          : error instanceof Error
            ? `${error.message} اگر نتیجه ذخیره نامشخص است، پیش از تلاش دوباره فهرست را تازه کنید.`
            : "ثبت تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function paid(record: FinancialRecord) {
    setBusy(true);
    setMessage("");
    try {
      await api.update(record.id, { paid: !record.paid_at }, record.updated_at);
      try {
        await load();
        if (editing?.id === record.id) reset();
      } catch {
        setRecords([]);
        setLoaded(false);
        setMessage(
          "وضعیت پرداخت ثبت شد، ولی تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید و صفحه را تازه کنید.",
        );
      }
    } catch {
      setRecords([]);
      setLoaded(false);
      setMessage(
        "وضعیت پرداخت تأیید نشد یا تغییر کرده است؛ پیش از تلاش دوباره اطلاعات را تازه کنید.",
      );
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
      if (editing?.id === record.id) reset();
      try {
        await load();
      } catch {
        setRecords([]);
        setLoaded(false);
        setMessage(
          "بایگانی انجام شد، اما تازه‌سازی ناموفق بود؛ صفحه را تازه کنید.",
        );
      }
    } catch {
      setMessage(
        "بایگانی مورد مالی تأیید نشد؛ پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="finance-page" dir="rtl">
      <div className="fin-heading">
        {onBack && (
          <button
            className="fin-heading-back"
            onClick={onBack}
            aria-label="بازگشت به خانه"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        {onSettings && (
          <button
            className="fin-heading-settings"
            onClick={onSettings}
            aria-label="حساب و تنظیمات"
          >
            <Settings size={22} />
          </button>
        )}
        <h2>مالی خونه</h2>
        <p>با هم، شفاف‌تر و آرام‌تر</p>
      </div>
      <p className="finance-sync">{sync}</p>
      <button
        type="button"
        className="minor finance-refresh"
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
      {loaded && (
        <>
          <label className="fin-currency">
            ارز گزارش{" "}
            <select
              value={currency}
              onChange={(e) => {
                const value = e.target.value;
                setCurrency(value);
                try {
                  window.history.replaceState(
                    window.history.state,
                    "",
                    ledgerUrl(new URL(window.location.href), filters, value),
                  );
                } catch {
                  /* optional */
                }
              }}
            >
              {Array.from(
                new Set([
                  "IRR",
                  currency,
                  ...records.map((record) => record.currency),
                ]),
              ).map((code) => (
                <option key={code} value={code}>
                  {code === "IRR" ? "تومان" : code}
                </option>
              ))}
            </select>
          </label>
          <FinanceOverview
            records={money}
            now={now}
            currency={currency}
            settlement={settlement}
            householdId={householdId}
            membersReady={membersReady}
            excluded={excludedSettlementRecords(
              money.filter(
                (record) =>
                  record.household_id === householdId &&
                  record.record_type !== "DEBT",
              ),
              members,
            )}
            onAdd={() => {
              reset();
              setFormOpen(true);
            }}
            onRecord={beginEdit}
            onCategory={(category, income) => {
              updateFilters(
                {
                  ...filters,
                  query: "",
                  type: income ? "INCOME" : "ALL",
                },
                income ? "" : category,
              );
              setLedgerOpen(true);
              window.setTimeout(
                () =>
                  ledgerRef.current?.scrollIntoView?.({
                    behavior: "smooth",
                    block: "start",
                  }),
                0,
              );
            }}
          />
        </>
      )}
      {formOpen && (
        <div className="finance-form" ref={formRef}>
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
                onChange={(e) => (
                  setKind(e.target.value as FinancialRecordType),
                  setRecurring(false)
                )}
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
                list="finance-category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <datalist id="finance-category-options">
              <option value="رفت‌وآمد" />
              <option value="مسکن" />
              <option value="خوراک" />
              <option value="خرید" />
              <option value="سلامت" />
              <option value="تفریح" />
              <option value="سایر" />
            </datalist>
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
            {!editing && billTypes.has(kind) && (
              <label className="item">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                قبض تکرارشونده
              </label>
            )}
            {!editing && recurring && billTypes.has(kind) && (
              <>
                <label>
                  دوره تکرار
                  <select
                    value={recurrenceRule}
                    onChange={(e) =>
                      setRecurrenceRule(e.target.value as typeof recurrenceRule)
                    }
                  >
                    <option value="DAILY">روزانه</option>
                    <option value="WEEKLY">هفتگی</option>
                    <option value="MONTHLY">ماهانه</option>
                    <option value="YEARLY">سالانه</option>
                  </select>
                </label>
                <small>
                  با ثبت پرداخت، قبض بعدی یک‌بار ساخته می‌شود؛ در صورت عدم
                  پرداخت خودکار ساخته نمی‌شود. منطقهٔ زمانی:{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </small>
              </>
            )}
            {editing && recurring && (
              <small>تغییرات فقط روی همین قبض اعمال می‌شود.</small>
            )}
            {editing && (
              <p role="status">
                {correctionPreview.length
                  ? `موارد تغییرکرده: ${correctionPreview.join("، ")}`
                  : "تغییری قابل ذخیره نیست یا ورودی نیاز به اصلاح دارد."}
              </p>
            )}
            {editing &&
              (isBillRecord(editing) ||
                (editing.record_type === "EXPENSE" &&
                  Boolean(editing.due_at))) &&
              !(
                editing.paid_at &&
                editing.is_recurring &&
                editing.recurrence_rule
              ) && (
                <button
                  type="button"
                  className="minor"
                  disabled={busy}
                  onClick={() => void paid(editing)}
                >
                  {editing.paid_at ? "بازگرداندن پرداخت" : "پرداخت شد"}
                </button>
              )}
            <button disabled={busy}>{editing ? "ذخیره تغییرات" : "ثبت"}</button>
            <button type="button" className="minor" onClick={reset}>
              انصراف
            </button>
          </form>
        </div>
      )}
      {loaded && (
        <details
          className="finance-details"
          ref={ledgerRef}
          open={ledgerOpen}
          onToggle={(event) => setLedgerOpen(event.currentTarget.open)}
        >
          <summary>دفتر مالی، گزارش‌ها و فیلترها</summary>
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
          <FinanceChart analytics={analytics} currency={currency} />
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
              <p>
                تقسیم برابر هزینه‌های مشترک بین اعضای فعلی، بدون بدهی‌های
                ثبت‌شده؛ نه ثبت پرداخت واقعی.
              </p>
              <p>
                مجموع هزینه‌های قابل تسویه:{" "}
                {formatAmount(settlement.total, currency)}
              </p>
              {members.length === 0 ? (
                <p>برای محاسبه، فهرست اعضای فعلی لازم است.</p>
              ) : (
                <ul>
                  {settlement.balances.map((member) => (
                    <li key={member.memberId}>
                      <strong>{member.name}</strong>
                      <span>
                        پرداخت: {formatAmount(member.paid, currency)} · سهم:{" "}
                        {formatAmount(member.share, currency)} ·{" "}
                        {member.balance > 0
                          ? "طلبکار"
                          : member.balance < 0
                            ? "بدهکار"
                            : "تسویه"}
                        : {formatAmount(Math.abs(member.balance), currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {excludedSettlementRecords(
                money.filter(
                  (record) =>
                    record.household_id === householdId &&
                    record.record_type !== "DEBT",
                ),
                members,
              ) > 0 && (
                <p>
                  برخی پرداخت‌ها به‌دلیل نبود پرداخت‌کننده در اعضای فعلی در
                  برآورد لحاظ نشده‌اند.
                </p>
              )}
              {settlement.transfers.length ? (
                <ul>
                  {settlement.transfers.map((transfer) => (
                    <li key={`${transfer.fromId}-${transfer.toId}`}>
                      {transfer.fromName} به {transfer.toName}:{" "}
                      {formatAmount(transfer.amount, currency)}
                    </li>
                  ))}
                </ul>
              ) : members.length > 0 ? (
                <p>انتقالی میان اعضای فعلی پیشنهاد نمی‌شود.</p>
              ) : null}
            </>
          )}
          <h3>دفتر مالی</h3>
          {categoryFilter && (
            <p>
              دسته انتخاب‌شده: {categoryFilter}{" "}
              <button
                type="button"
                className="minor"
                onClick={() => updateFilters(filters, "")}
              >
                حذف فیلتر دسته
              </button>
            </p>
          )}
          <label>
            جست‌وجو
            <input
              value={filters.query}
              onChange={(e) =>
                updateFilters({ ...filters, query: e.target.value })
              }
            />
          </label>
          <label>
            نوع
            <select
              value={filters.type}
              onChange={(e) =>
                updateFilters({
                  ...filters,
                  type: e.target.value as LedgerType,
                })
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
                updateFilters({
                  ...filters,
                  paid: e.target.value as PaidFilter,
                })
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
                updateFilters({
                  ...filters,
                  days: e.target.value as LedgerDays,
                })
              }
            >
              <option value="ALL">همه</option>
              <option value="30">۳۰ روز</option>
              <option value="90">۹۰ روز</option>
              <option value="365">یک سال</option>
            </select>
          </label>
          <p>
            {ledger.summary.count} مورد · درآمد:{" "}
            {formatAmount(ledger.summary.income, currency)} · هزینه:{" "}
            {formatAmount(ledger.summary.expense, currency)} · قبض پرداخت‌نشده:{" "}
            {formatAmount(ledger.summary.outstanding, currency)}
          </p>
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
                    {record.category && ` · ${record.category}`}
                    {record.due_at &&
                      ` · سررسید: ${formatPersianDate(record.due_at)}`}
                    {record.paid_at &&
                      ` · پرداخت: ${formatPersianDate(record.paid_at)}`}
                  </small>
                  {record.is_recurring && record.recurrence_rule && (
                    <small>قبض تکراری · {record.recurrence_rule}</small>
                  )}
                  {record.note && <p>{record.note}</p>}
                </div>
                <div>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() => beginEdit(record)}
                  >
                    ویرایش
                  </button>
                  {(isBillRecord(record) ||
                    (record.record_type === "EXPENSE" &&
                      Boolean(record.due_at))) &&
                    !(
                      record.paid_at &&
                      record.is_recurring &&
                      record.recurrence_rule
                    ) && (
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
        </details>
      )}
    </div>
  );
}
