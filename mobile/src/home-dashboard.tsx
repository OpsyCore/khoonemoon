import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CalendarDays,
  CheckSquare2,
  Copy,
  Heart,
  House,
  ListTodo,
  Plus,
  Send,
  Settings,
  UsersRound,
} from "lucide-react";
import { directHousehold } from "@/features/households/direct-client";
import { reloadAfterSave } from "./after-save";
import { formatPersianDate } from "@/shared/utils/locale";
import "./home-dashboard.css";

type Details = Awaited<
  ReturnType<ReturnType<typeof directHousehold>["details"]>
>;
type Overview = {
  open: number | null;
  completed: number | null;
  events: number | null;
  recent: { id: string; title: string; date: string; kind: string }[] | null;
};
export function HomeDashboard({
  client,
  userId,
  householdId,
  onHouseholdChange,
  onSettings,
  onTasks,
  onCalendar,
  initialInviteCode = "",
  extra,
}: {
  client: SupabaseClient;
  userId: string;
  householdId: string | null;
  onHouseholdChange: (id: string | null) => void;
  onSettings: () => void;
  onTasks: () => void;
  onCalendar: () => void;
  initialInviteCode?: string;
  extra?: React.ReactNode;
}) {
  const api = useMemo(() => directHousehold(client), [client]);
  const [details, setDetails] = useState<Details | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [name, setName] = useState("");
  const [houseName, setHouseName] = useState("");
  const [joinCode, setJoinCode] = useState(initialInviteCode);
  const [code, setCode] = useState("");
  const [expiry, setExpiry] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [mode, setMode] = useState<"create" | "join" | null>(
    initialInviteCode ? "join" : null,
  );
  const load = useCallback(async () => {
    if (!householdId) return;
    const result = await api.details(householdId, userId);
    setDetails(result);
    setName(result.house.name);
  }, [api, householdId, userId]);
  useEffect(() => {
    if (!householdId) return;
    let active = true;
    void api
      .details(householdId, userId)
      .then((data) => {
        if (active) {
          setDetails(data);
          setName(data.house.name);
        }
      })
      .catch(() => {
        if (active)
          setMessage("دریافت اطلاعات خانه ناموفق بود؛ تازه‌سازی کنید.");
      });
    return () => {
      active = false;
    };
  }, [api, householdId, userId]);
  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    void Promise.all([
      client
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .is("archived_at", null)
        .in("status", ["PENDING", "IN_PROGRESS"]),
      client
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .is("archived_at", null)
        .eq("status", "COMPLETED"),
      client
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .gte("start_at", now.toISOString())
        .lt("start_at", week.toISOString()),
      client
        .from("tasks")
        .select("id,title,created_at")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(3),
      client
        .from("events")
        .select("id,title,created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(3),
    ])
      .then(([open, completed, events, tasks, recentEvents]) => {
        if (!active) return;
        const recent =
          tasks.error || recentEvents.error
            ? null
            : [
                ...(tasks.data ?? []).map((x) => ({
                  id: x.id,
                  title: x.title,
                  date: x.created_at,
                  kind: "کار",
                })),
                ...(recentEvents.data ?? []).map((x) => ({
                  id: x.id,
                  title: x.title,
                  date: x.created_at,
                  kind: "رویداد",
                })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 3);
        setOverview({
          open: open.error ? null : open.count,
          completed: completed.error ? null : completed.count,
          events: events.error ? null : events.count,
          recent,
        });
      })
      .catch(() => {
        if (active)
          setOverview({
            open: null,
            completed: null,
            events: null,
            recent: null,
          });
      });
    return () => {
      active = false;
    };
  }, [client, householdId]);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      await fn();
    } catch {
      setMessage(
        "عملیات خانه تأیید نشد؛ پیش از تلاش دوباره وضعیت را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refreshAfterChange() {
    if (await reloadAfterSave(load)) setNeedsRefresh(false);
    else {
      setNeedsRefresh(true);
      setMessage("تغییر ذخیره شد اما تازه‌سازی ناموفق بود؛ دوباره ثبت نکنید.");
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const id = await api.create(houseName);
      setHouseName("");
      setMode(null);
      onHouseholdChange(id);
    });
  }
  function join(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const id = await api.join(joinCode);
      setJoinCode("");
      setMode(null);
      onHouseholdChange(id);
    });
  }
  function rename(event: FormEvent) {
    event.preventDefault();
    if (!householdId) return;
    void action(async () => {
      await api.rename(householdId, name);
      await refreshAfterChange();
    });
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("کد دعوت کپی شد؛ آن را فقط با فرد موردنظر به اشتراک بگذارید.");
    } catch {
      setNotice("کپی خودکار در دسترس نیست؛ کد را انتخاب و کپی کنید.");
    }
  }
  async function shareCode() {
    if (!navigator.share) {
      await copyCode();
      return;
    }
    try {
      await navigator.share({
        title: "دعوت به خونه‌مون",
        text: `کد دعوت خانه: ${code}`,
      });
    } catch {
      setNotice("اشتراک‌گذاری انجام نشد؛ می‌توانید کد را کپی کنید.");
    }
  }
  const n = (value: number | null | undefined) =>
    value == null ? "—" : value.toLocaleString("fa-IR");
  return (
    <div className="home-ref" dir="rtl">
      <div className="home-ref-heading">
        <h2>خونه‌ی ما</h2>
        <button type="button" aria-label="حساب و تنظیمات" onClick={onSettings}>
          <Settings size={23} />
        </button>
      </div>
      <div className="home-ref-hero">
        <span className="home-ref-branch" aria-hidden="true" />
        <span className="home-ref-cottage" aria-hidden="true" />
        <div>
          <House size={23} strokeWidth={1.4} />
          <h3>{details?.house.name ?? "آشیانه‌ی ما"}</h3>
          <p>جایی که زندگی قشنگ‌تر می‌شود</p>
          <span>── ♡ ──</span>
        </div>
      </div>
      {message && (
        <p role="alert" className="home-ref-message">
          {message}
        </p>
      )}
      {notice && (
        <p role="status" className="home-ref-notice">
          {notice}
        </p>
      )}
      {householdId && !details && !message && (
        <p role="status">در حال دریافت اطلاعات خانه…</p>
      )}
      {householdId && (
        <button
          className="home-ref-refresh"
          type="button"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await load();
              setNeedsRefresh(false);
            })
          }
        >
          تازه‌سازی خانه
        </button>
      )}
      {details && (
        <>
          <div className="home-ref-members">
            {details.members.map((member) => (
              <div key={member.user_id} className="home-ref-member">
                <span className="home-ref-avatar" aria-hidden="true">
                  {member.name.slice(0, 1)}
                </span>
                <strong>{member.name}</strong>
                <small>
                  {member.role === "OWNER" ? "مالک خانه" : "عضو خانه"}
                </small>
                <span className="home-ref-member-tag">
                  <House size={15} /> خانه‌ی ما
                </span>
              </div>
            ))}
          </div>
          <div className="home-ref-status">
            <div className="home-ref-status-header">
              <span>
                <House size={22} />
              </span>
              <div>
                <strong>وضعیت خانه‌ی ما</strong>
                <small>خلاصه موارد قابل مشاهده</small>
              </div>
              <em>
                با هم،
                <br />
                همیشه بهتر است ♥
              </em>
            </div>
            <div className="home-ref-stats">
              <button onClick={onTasks}>
                <CheckSquare2 size={19} />
                <b>{n(overview?.open)}</b>
                <small>کارهای جاری</small>
              </button>
              <button onClick={onCalendar}>
                <CalendarDays size={19} />
                <b>{n(overview?.events)}</b>
                <small>رویدادهای ۷ روز آینده</small>
              </button>
              <button onClick={onTasks}>
                <Heart size={19} />
                <b>{n(overview?.completed)}</b>
                <small>کارهای انجام‌شده</small>
              </button>
              <div>
                <UsersRound size={19} />
                <b>{n(details.members.length)}</b>
                <small>اعضای خانه</small>
              </div>
            </div>
          </div>
          {details.role === "OWNER" && (
            <div className="home-ref-invite">
              <span className="home-ref-decor" aria-hidden="true" />
              <div className="home-ref-section-title">
                <span>
                  <Send size={23} />
                </span>
                <div>
                  <strong>دعوت از شریک زندگی</strong>
                  <small>کد را فقط با فرد موردنظرتان به اشتراک بگذارید</small>
                </div>
              </div>
              {code ? (
                <>
                  <div className="home-ref-code">
                    <input
                      aria-label="کد دعوت"
                      value={code}
                      readOnly
                      dir="ltr"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      onClick={() => void copyCode()}
                      aria-label="کپی کد دعوت"
                    >
                      <Copy size={19} />
                    </button>
                  </div>
                  <p>
                    اعتبار تا {formatPersianDate(expiry)}؛ کد را محرمانه نگه
                    دارید.
                  </p>
                  <button
                    type="button"
                    className="home-ref-primary"
                    onClick={() => void shareCode()}
                  >
                    اشتراک‌گذاری کد
                  </button>
                  <button
                    type="button"
                    className="home-ref-refresh"
                    disabled={busy || needsRefresh}
                    onClick={() =>
                      void action(async () => {
                        const invite = await api.invite(userId, householdId!);
                        setCode(invite.code);
                        setExpiry(invite.expiresAt);
                        await refreshAfterChange();
                      })
                    }
                  >
                    ساخت دعوت دیگر
                  </button>
                </>
              ) : (
                <button
                  className="home-ref-primary"
                  type="button"
                  disabled={busy || needsRefresh}
                  onClick={() =>
                    void action(async () => {
                      const invite = await api.invite(userId, householdId!);
                      setCode(invite.code);
                      setExpiry(invite.expiresAt);
                      await refreshAfterChange();
                    })
                  }
                >
                  ساخت کد دعوت
                </button>
              )}
            </div>
          )}
          <div className="home-ref-activity">
            <div className="home-ref-section-title">
              <span>
                <ListTodo size={23} />
              </span>
              <div>
                <strong>موارد اخیر خانه‌ی ما</strong>
                <small>کارها و رویدادهای ثبت‌شده که به آنها دسترسی دارید</small>
              </div>
            </div>
            {!overview ? (
              <p>در حال دریافت…</p>
            ) : overview.recent === null ? (
              <p>دریافت موارد اخیر ناموفق بود.</p>
            ) : overview.recent.length === 0 ? (
              <p>هنوز کار یا رویدادی برای نمایش وجود ندارد.</p>
            ) : (
              <ul>
                {overview.recent.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <span>●</span>
                    <div>
                      <b>{item.title}</b>
                      <small>
                        {item.kind} · {formatPersianDate(item.date)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <details className="home-ref-manage">
            <summary>مدیریت خانه و دعوت‌ها</summary>
            {details.role === "OWNER" && (
              <>
                <form onSubmit={rename}>
                  <label>
                    نام خانه
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </label>
                  <button disabled={busy || needsRefresh}>
                    تغییر نام خانه
                  </button>
                </form>
                <h3>دعوت‌ها</h3>
                <ul>
                  {details.invitations.map((invitation) => (
                    <li key={invitation.id}>
                      <span>
                        {invitation.status} —{" "}
                        {new Intl.DateTimeFormat("fa-IR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(invitation.expires_at))}
                      </span>
                      {invitation.status === "PENDING" && (
                        <button
                          disabled={busy || needsRefresh}
                          onClick={() =>
                            void action(async () => {
                              await api.cancel(invitation.id);
                              setCode("");
                              setExpiry("");
                              await refreshAfterChange();
                            })
                          }
                        >
                          لغو دعوت
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm("از خانه خارج شوید؟"))
                  void action(async () => {
                    await api.leave();
                    onHouseholdChange(null);
                  });
              }}
            >
              ترک خانه
            </button>
          </details>
        </>
      )}
      {!householdId && (
        <>
          <p className="home-ref-empty">
            هنوز خانه‌ای ندارید؛ یک خانه بسازید یا با کد دعوت به خانه بپیوندید.
          </p>
          <div className="home-ref-entry">
            <button onClick={() => setMode("join")}>
              <UsersRound />
              <span>
                <strong>پیوستن به خانه</strong>
                <small>با کد دعوت</small>
              </span>
            </button>
            <button onClick={() => setMode("create")}>
              <Plus />
              <span>
                <strong>ایجاد خانه‌ی جدید</strong>
                <small>شروع یک فصل تازه</small>
              </span>
            </button>
          </div>
          {mode === "create" && (
            <form className="home-ref-entry-form" onSubmit={create}>
              <label>
                نام خانه
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                />
              </label>
              <button disabled={busy}>ایجاد خانه</button>
            </form>
          )}
          {mode === "join" && (
            <form className="home-ref-entry-form" onSubmit={join}>
              <label>
                کد دعوت
                <input
                  required
                  minLength={12}
                  maxLength={128}
                  dir="ltr"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </label>
              <button disabled={busy}>پیوستن به خانه</button>
            </form>
          )}
        </>
      )}
      {extra}
    </div>
  );
}
