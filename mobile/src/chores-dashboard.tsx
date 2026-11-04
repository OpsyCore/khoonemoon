import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  Clock3,
  Heart,
  House,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { directChores } from "@/features/chores/direct-client";
import { resolveCurrentAssignee } from "@/features/chores/rotation";
import {
  choreDashboardModel,
  dueLabel,
  frequencyLabel,
  type HistoryRow,
  type NamedMember,
} from "@/features/chores/reference-model";
import type { ChoreRecord } from "@/features/chores/types";
import { Chores } from "./chores";
import "./chores-dashboard.css";
function art(title: string) {
  if (/ظرف|بشقاب|لیوان|شستن/.test(title)) return "dishes";
  if (/جارو|تمیز|نظافت/.test(title)) return "broom";
  if (/گل|گیاه|آبیاری/.test(title)) return "plant";
  return "other";
}
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      className={`chore-avatar ${large ? "large" : ""}`}
      aria-label={name}
      title={name}
    >
      <span>{name.trim().slice(0, 1)}</span>
    </span>
  );
}
export function ChoresDashboard({
  client,
  householdId,
  onSettings,
  onHouse,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onSettings: () => void;
  onHouse: () => void;
}) {
  const api = useMemo(() => directChores(client), [client]);
  const [chores, setChores] = useState<ChoreRecord[]>([]),
    [history, setHistory] = useState<HistoryRow[]>([]),
    [members, setMembers] = useState<NamedMember[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<"active" | "history">("active"),
    [manage, setManage] = useState(false),
    [now, setNow] = useState(() => new Date());
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!householdId) return false;
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const [items, rows, names] = await Promise.all([
        api.list(householdId),
        api.householdHistory(householdId, "1970-01-01T00:00:00.000Z"),
        client.rpc("household_member_names", {
          target_household_id: householdId,
        }),
      ]);
      if (names.error) throw names.error;
      if (request !== sequence.current) return false;
      setChores(items);
      setHistory(rows);
      setMembers((names.data ?? []) as NamedMember[]);
      setReady(true);
      return true;
    } catch {
      if (request === sequence.current) {
        setReady(false);
        setError(
          "دریافت کارها یا تاریخچه ناموفق بود؛ اتصال را بررسی و دوباره تلاش کنید.",
        );
      }
      return false;
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [api, client, householdId]);
  useEffect(() => {
    // Initial synchronization with the database.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (householdId) void load();
    const generation = sequence;
    const refresh = () => void load();
    window.addEventListener("khoonemoon:schedule-changed", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      generation.current++;
      window.removeEventListener("khoonemoon:schedule-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [householdId, load]);
  const model = useMemo(
    () => choreDashboardModel(chores, history, members, now),
    [chores, history, members, now],
  );
  async function complete(chore: ChoreRecord) {
    if (busy || loading || !ready) return;
    if (!window.confirm(`انجام «${chore.title}» ثبت شود؟`)) return;
    setBusy(true);
    setNotice("");
    try {
      if (typeof chore.completion_revision !== "number") throw new Error();
      await api.completeVersion(chore.id, chore.completion_revision);
      const refreshed = await load();
      setNotice(
        refreshed
          ? "انجام کار ثبت شد."
          : "انجام کار ثبت شد، اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید.",
      );
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } catch {
      setReady(false);
      setError(
        "نتیجه ثبت انجام مشخص نیست یا کار تغییر کرده؛ پیش از تلاش دوباره فهرست را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  const renderChore = (chore: ChoreRecord) => {
    const memberId = resolveCurrentAssignee({
      rotationMode: chore.rotation_mode,
      currentRotationIndex: chore.current_rotation_index,
      steps: chore.chore_rotation_steps ?? [],
    });
    const name = memberId
      ? (model.names.get(memberId) ?? "عضو سابق خانه")
      : "بدون مسئول";
    const kind = art(chore.title);
    return (
      <article className="chore-ref-row" key={chore.id}>
        <div className={`chore-ref-art ${kind}`} aria-hidden="true">
          {kind === "other" && <Sparkles />}
        </div>
        <div className="chore-ref-row-main">
          <strong>{chore.title}</strong>
          <span>
            <Avatar name={name} />
            {name}
          </span>
        </div>
        <div className="chore-ref-meta">
          <span>
            <RefreshCw />
            {frequencyLabel(chore)}
          </span>
          <span>
            <CalendarDays />
            {dueLabel(chore.next_due_at, now)}
          </span>
        </div>
        <button
          type="button"
          disabled={busy || loading || !ready}
          onClick={() => void complete(chore)}
        >
          انجام شد
        </button>
      </article>
    );
  };
  const historyRow = (row: HistoryRow) => (
    <li key={row.id}>
      <span>
        <span
          className={`chore-ref-art mini ${art(row.chores?.title ?? "")}`}
          aria-hidden="true"
        >
          {art(row.chores?.title ?? "") === "other" && <Sparkles />}
        </span>
        {row.chores?.title ?? "کار حذف‌شده"}
        {row.note ? ` · ${row.note}` : ""}
      </span>
      <span>
        <Avatar name={model.names.get(row.completed_by) ?? "عضو سابق خانه"} />{" "}
        توسط {model.names.get(row.completed_by) ?? "عضو سابق خانه"}
      </span>
      <time dateTime={row.completed_at}>
        {new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(row.completed_at))}
      </time>
    </li>
  );
  return (
    <section className="chore-ref" dir="rtl">
      <header className="chore-ref-header">
        <button type="button" onClick={onSettings} aria-label="تنظیمات">
          <Settings />
        </button>
        <div className="chore-ref-brand">
          <span>
            ⌂ <Heart size={15} fill="currentColor" />
          </span>
          <strong>خونه‌مون</strong>
          <small>خونه قشنگ‌تر با ما دو نفر</small>
        </div>
      </header>
      <div className="chore-ref-intro">
        <h1>کارهای خونه</h1>
        <p>
          <Heart size={16} fill="currentColor" /> با هم، برای خونه‌ای که دوستش
          داریم
        </p>
      </div>
      {!householdId ? (
        <div className="chore-ref-empty">
          <p>برای تقسیم کارها ابتدا خانه بسازید یا به خانه بپیوندید.</p>
          <button type="button" onClick={onHouse}>
            رفتن به خانه
          </button>
        </div>
      ) : (
        <>
          <div className="chore-ref-hero">
            <div>
              <strong>
                {loading && !ready
                  ? "در حال دریافت نوبت‌ها…"
                  : !ready
                    ? "نوبت‌ها در دسترس نیستند"
                    : model.assignedNames.length
                      ? `نوبت امروز با ${model.assignedNames.join(" و ")} است`
                      : "برای امروز نوبتی ثبت نشده"}
              </strong>
              <p>چه خوب که با هم پیش می‌ریم ♥</p>
            </div>
            <Avatar name={model.assignedNames[0] ?? "کاربر"} large />
            <div className="chore-ref-quote">
              کارهای کوچک
              <br /> زندگی مشترک رو
              <br /> زیباتر می‌کنن.
            </div>
          </div>
          <div
            className="chore-ref-tabs"
            role="group"
            aria-label="نمای کارهای خانه"
          >
            <button
              type="button"
              aria-pressed={tab === "active"}
              onClick={() => setTab("active")}
            >
              <CheckSquare2 /> کارهای فعال
            </button>
            <button
              type="button"
              aria-pressed={tab === "history"}
              onClick={() => setTab("history")}
            >
              <Clock3 /> تاریخچه
            </button>
          </div>
          {error && (
            <div className="chore-ref-error" role="alert">
              {error}
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void load()}
              >
                تازه‌سازی
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="chore-ref-notice">
              {notice}
            </p>
          )}
          {loading && <p role="status">در حال دریافت اطلاعات…</p>}
          {ready && tab === "active" && (
            <>
              <div className="chore-ref-heading">
                <h2>
                  <Sun /> کارهای امروز
                </h2>
                <span>
                  {model.today.length.toLocaleString("fa-IR")} کار برای امروز
                </span>
              </div>
              {model.due.length ? (
                model.due.map(renderChore)
              ) : (
                <p className="chore-ref-empty">
                  کاری برای امروز یا عقب‌افتاده وجود ندارد.
                </p>
              )}
              {model.upcoming.length > 0 && (
                <>
                  <div className="chore-ref-heading">
                    <h2>
                      <CalendarDays /> کارهای پیش‌رو
                    </h2>
                  </div>
                  {model.upcoming.map(renderChore)}
                </>
              )}
            </>
          )}
          {ready && tab === "history" && (
            <div className="chore-ref-history">
              <h2>
                <Clock3 /> تاریخچه انجام کارها
              </h2>
              {history.length ? (
                <ul>
                  {history
                    .filter((row) =>
                      Number.isFinite(Date.parse(row.completed_at)),
                    )
                    .map(historyRow)}
                </ul>
              ) : (
                <p>هنوز کاری ثبت نشده است.</p>
              )}
            </div>
          )}
          <button
            type="button"
            className="chore-ref-add"
            onClick={() => {
              setManage(true);
              window.setTimeout(
                () =>
                  document
                    .getElementById("chore-ref-manage")
                    ?.scrollIntoView({ block: "start", behavior: "smooth" }),
                0,
              );
            }}
          >
            <Plus /> افزودن کار جدید
          </button>
          {ready && (
            <>
              <div className="chore-ref-summary">
                <div className="chore-ref-heading">
                  <h2>
                    <BarChart3 /> توزیع کارها در این هفته
                  </h2>
                  <span>
                    <Heart size={15} fill="currentColor" /> تعادل یعنی حال خوب
                  </span>
                </div>
                {model.total === 0 && (
                  <p>از شنبه تا امروز هنوز کاری ثبت نشده است.</p>
                )}
                {model.shares.map((share, i) => (
                  <div className="chore-ref-share" key={share.id}>
                    <Avatar name={share.name} />
                    <span>{share.name}</span>
                    <div
                      className="chore-ref-bar"
                      role="meter"
                      aria-label={`سهم ${share.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={share.percent}
                    >
                      <i
                        style={{
                          width: `${share.percent}%`,
                          background: i % 2 ? "#74805b" : "#bf856a",
                        }}
                      />
                    </div>
                    <small>
                      {share.count.toLocaleString("fa-IR")} کار
                      <br />({share.percent.toLocaleString("fa-IR")}٪)
                    </small>
                  </div>
                ))}
              </div>
              {tab === "active" && (
                <div className="chore-ref-history">
                  <div className="chore-ref-heading">
                    <h2>
                      <Clock3 /> آخرین انجام‌شده‌ها
                    </h2>
                    <button type="button" onClick={() => setTab("history")}>
                      مشاهده همه <ChevronLeft />
                    </button>
                  </div>
                  {history.length ? (
                    <ul>
                      {history
                        .filter((row) =>
                          Number.isFinite(Date.parse(row.completed_at)),
                        )
                        .slice(0, 3)
                        .map(historyRow)}
                    </ul>
                  ) : (
                    <p>هنوز کاری ثبت نشده است.</p>
                  )}
                </div>
              )}
            </>
          )}
          <details
            id="chore-ref-manage"
            className="chore-ref-manage"
            open={manage}
            onToggle={(e) => setManage(e.currentTarget.open)}
          >
            <summary>افزودن و مدیریت کارها</summary>
            {manage && <Chores client={client} householdId={householdId} />}
          </details>
        </>
      )}
      <div className="chore-ref-bottom-art" aria-hidden="true" />
      <span className="chore-ref-home" aria-hidden="true">
        <House />
      </span>
    </section>
  );
}
