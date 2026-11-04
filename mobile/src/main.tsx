/// <reference types="vite/client" />
import "@fontsource-variable/vazirmatn";
import { MobileLogin } from "./login";
import { OfflineScreen } from "@/shared/ui/offline-screen";
import { probeConnection } from "@/shared/utils/connection-probe";
import "../../public/offline-screen.css";
import { RecoveryReference } from "@/features/auth/components/recovery-reference";
import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { createRoot } from "react-dom/client";
import { useDueReminderCount } from "./reminder-badge";
import { useMobileNotifications } from "./notifications";
import { disableBrowserPush } from "./web-push";
import { Documents } from "./documents";
import { Reminders } from "./reminders";
import { Shopping } from "./shopping";
import { Search } from "./search";
import { ExportData } from "./export";
import { Today } from "./today";
import { QuickAdd } from "./quick-add";
import { loginSchema, signupSchema } from "@/features/auth/schemas";
import { ZodError } from "zod";
import {
  ANDROID_RECOVERY_REDIRECT,
  changeRecoveredPassword,
  requestRecovery,
} from "./recovery";
import { CalendarEvents } from "./calendar";
import { Tasks } from "./tasks";
import { NewTask } from "./new-task";
import { NewEvent } from "./new-event";
import { Finance } from "./finance";
import { Chores } from "./chores";
import { ChoresDashboard } from "./chores-dashboard";
import { Profile } from "./profile";
import { MobileNavigation, type MobilePage } from "./navigation";
import { useNativeBack } from "./native-back";
import { PendingTransferPanel } from "@/features/households/pending-transfer-panel";
import { HomeDashboard } from "./home-dashboard";
import { ThemeSettings } from "./theme-settings";
import { SettingsDashboard } from "./settings";
import { InstallGuide, useInstallPrompt } from "./install-guide";
import {
  readTheme,
  resolveTheme,
  writeTheme,
  THEME_KEY,
  type ThemeMode,
} from "./theme";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Only publishable/anon keys belong in client bundles. A service-role key must
// never be supplied to this build. Database RLS remains the security boundary.
const client =
  url && anonKey
    ? createClient(url, anonKey, { auth: { flowType: "pkce" } })
    : null;

function App() {
  const [revision, setRevision] = useState(0);
  const [newEventDate, setNewEventDate] = useState<Date | undefined>();
  const installState = useInstallPrompt();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return readTheme(window.localStorage);
    } catch {
      return "system";
    }
  });
  const [themePersisted, setThemePersisted] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState("");
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) setOfflineDismissed(false);
      else setOfflineMessage("");
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const apply = () => {
      const resolved = resolveTheme(theme, media?.matches ?? false);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#262119" : "#f5ebdd");
    };
    apply();
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) {
        try {
          setTheme(readTheme(window.localStorage));
        } catch {
          setTheme("system");
        }
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function chooseTheme(mode: ThemeMode) {
    setTheme(mode);
    try {
      setThemePersisted(writeTheme(window.localStorage, mode));
    } catch {
      setThemePersisted(false);
    }
  }
  const [page, setPage] = useState<MobilePage>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "reminders") return "reminders";
    if (params.get("page") === "finance") return "finance";
    if (params.get("page") === "search") return "search";
    return params.has("search_q") ? "search" : "tasks";
  });
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (
        event.source === navigator.serviceWorker.controller &&
        event.data?.type === "khoonemoon:open-reminders"
      )
        setPage("reminders");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!client);
  const [authError, setAuthError] = useState("");
  const [authAttempt, setAuthAttempt] = useState(0);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(
    "login",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recovery, setRecovery] = useState(() => {
    try {
      return sessionStorage.getItem("khoonemoon:recovery") === "1";
    } catch {
      return false;
    }
  });
  useNativeBack(page, !!session && !recovery, setPage);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<string | null | undefined>(
    undefined,
  );
  const [householdError, setHouseholdError] = useState(false);
  const [householdAttempt, setHouseholdAttempt] = useState(0);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    let sessionChanged = false;
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || sessionChanged) return;
        if (error) throw error;
        setSession(data.session);
        setAuthError("");
        setReady(true);
      })
      .catch(() => {
        if (alive && !sessionChanged) {
          setAuthError("دریافت وضعیت حساب ناموفق بود؛ اتصال را بررسی کنید.");
          setReady(false);
        }
      });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      if (event !== "INITIAL_SESSION" || next) sessionChanged = true;
      setSession(next);
      if (event !== "INITIAL_SESSION" || next) {
        setReady(true);
        setAuthError("");
      }
      if (event === "PASSWORD_RECOVERY") {
        try {
          sessionStorage.setItem("khoonemoon:recovery", "1");
        } catch {}
        setRecovery(true);
      }
      if (event === "SIGNED_OUT") {
        try {
          sessionStorage.removeItem("khoonemoon:recovery");
        } catch {}
        setRecovery(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [authAttempt]);

  useEffect(() => {
    if (!client || !window.KhoonemoonNotifications) return;
    let alive = true;
    const consume = () => {
      const code = window.KhoonemoonNotifications?.takeRecoveryCode?.();
      if (!code) return;
      void client.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (alive && error)
            setMessage(
              "پیوند بازیابی نامعتبر یا منقضی است؛ دوباره درخواست کنید.",
            );
        })
        .catch(() => {
          if (alive)
            setMessage(
              "اتصال برای بازیابی رمز برقرار نشد؛ دوباره درخواست کنید.",
            );
        });
    };
    consume();
    const timer = window.setInterval(consume, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const userId = session?.user.id;
  const notificationStatus = useMobileNotifications(client, userId, ready);
  const dueCount = useDueReminderCount(client, userId);

  useEffect(() => {
    // Clear the previous account’s data before loading the next account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHousehold(undefined);
    setHouseholdError(false);
    if (!userId || !client) return;
    let alive = true;
    void Promise.resolve(
      client
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .is("left_at", null)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setHouseholdError(true);
        else setHousehold(data?.household_id ?? null);
      })
      .catch(() => {
        if (alive) setHouseholdError(true);
      });
    return () => {
      alive = false;
    };
  }, [userId, householdAttempt]);

  async function action(fn: () => Promise<void>) {
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      setMessage(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "اطلاعات معتبر وارد کنید.")
          : "عملیات تأیید نشد؛ اطلاعات و اتصال را بررسی کنید و پیش از تلاش دوباره وضعیت را تازه کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  function login(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const input = loginSchema.parse({ email, password });
      const { error } = await client.auth.signInWithPassword(input);
      if (error) throw error;
      setPassword("");
    });
  }
  function signup(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const input = signupSchema.parse({ fullName, email, password });
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.fullName } },
      });
      if (error) throw error;
      setPassword("");
      if (!data.session)
        setMessage("ثبت‌نام انجام شد؛ برای ورود تأیید ایمیل لازم است.");
    });
  }
  function forgot(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const redirectTo = window.KhoonemoonNotifications
        ? ANDROID_RECOVERY_REDIRECT
        : `${window.location.origin}${window.location.pathname}`;
      await requestRecovery(client, email, redirectTo);
      setMessage(
        "اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود. پیوند را روی همین دستگاه باز کنید.",
      );
    });
  }
  async function retryOffline() {
    if (offlineBusy || !url || !anonKey) return;
    setOfflineBusy(true);
    setOfflineMessage("");
    const connected = await probeConnection(
      `${url.replace(/\/$/, "")}/auth/v1/health`,
      { apikey: anonKey },
    );
    setOfflineBusy(false);
    if (connected) {
      setOnline(true);
      setOfflineDismissed(false);
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
    } else setOfflineMessage("اتصال به سرور برقرار نشد؛ دوباره امتحان کنید.");
  }
  function updatePassword(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      await changeRecoveredPassword(client, password, confirmPassword);
      window.dispatchEvent(new Event("khoonemoon:credentials-changed"));
      setPassword("");
      setConfirmPassword("");
      try {
        sessionStorage.removeItem("khoonemoon:recovery");
      } catch {}
      setRecovery(false);
      setMessage("رمز عبور تغییر کرد.");
    });
  }

  return (
    <main
      className={
        !session && ready && client && !recovery && authMode === "login"
          ? "login-mobile-main"
          : !session && ready && client && !recovery && authMode === "forgot"
            ? "recovery-mobile-main"
            : undefined
      }
    >
      {!(
        ready &&
        client &&
        !session &&
        !recovery &&
        (authMode === "login" || authMode === "forgot")
      ) && (
        <header
          className={
            (page === "calendar" ||
              page === "shopping" ||
              page === "documents" ||
              page === "house" ||
              page === "finance" ||
              page === "tasks" ||
              page === "chores" ||
              page === "search" ||
              page === "settings" ||
              page === "task-new" ||
              page === "event-new") &&
            session &&
            !recovery
              ? "calendar-shell-header"
              : undefined
          }
        >
          {!(
            (page === "calendar" ||
              page === "shopping" ||
              page === "documents" ||
              page === "house" ||
              page === "finance" ||
              page === "tasks" ||
              page === "chores" ||
              page === "search" ||
              page === "settings" ||
              page === "task-new" ||
              page === "event-new") &&
            session &&
            !recovery
          ) && (
            <>
              <h1>خونه‌مون</h1>
              <p>دفتر کوچک خانه و خانوادهٔ ما</p>
            </>
          )}
          {session && !recovery && client && ready && (
            <MobileNavigation
              page={page}
              dueCount={dueCount ?? 0}
              onNavigate={setPage}
            />
          )}
        </header>
      )}

      {!online && !offlineDismissed && (
        <div
          className="offline-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-title"
        >
          <OfflineScreen
            message={offlineMessage}
            actions={
              <>
                <button
                  className="offline-retry"
                  type="button"
                  disabled={offlineBusy}
                  onClick={() => void retryOffline()}
                >
                  {offlineBusy ? "در حال بررسی…" : "تلاش مجدد"}
                </button>
                <button
                  className="offline-back"
                  type="button"
                  onClick={() => {
                    if (
                      (page === "task-new" || page === "event-new") &&
                      !window.confirm(
                        "برای بازگشت به امروز ممکن است تغییرات ذخیره‌نشده از دست بروند. ادامه می‌دهید؟",
                      )
                    )
                      return;
                    if (session) setPage("tasks");
                    setOfflineDismissed(true);
                  }}
                >
                  بازگشت به امروز
                </button>
              </>
            }
          />
        </div>
      )}
      {!online && offlineDismissed && (
        <button
          type="button"
          className="network-status"
          onClick={() => setOfflineDismissed(false)}
        >
          آفلاین هستید؛ دریافت و ذخیره داده‌ها به اینترنت نیاز دارد. برای بررسی
          اتصال بزنید.
        </button>
      )}
      {message &&
        !(
          ready &&
          client &&
          !session &&
          !recovery &&
          authMode === "forgot"
        ) && (
          <p role="alert" className="error">
            {message}
          </p>
        )}
      {!client ? (
        <section>
          <p>اتصال Supabase برای این ساخت تنظیم نشده است.</p>
        </section>
      ) : !ready ? (
        <section>
          {authError ? (
            <>
              <p role="alert">{authError}</p>
              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthAttempt((n) => n + 1);
                }}
              >
                تلاش دوباره
              </button>
            </>
          ) : (
            <p role="status">در حال آماده‌سازی…</p>
          )}
        </section>
      ) : recovery && session ? (
        <section>
          <h2>انتخاب رمز جدید</h2>
          <form onSubmit={updatePassword}>
            <label>
              رمز جدید
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              تکرار رمز
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>ذخیره رمز جدید</button>
          </form>
        </section>
      ) : !session && authMode === "login" ? (
        <MobileLogin
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          busy={busy}
          onSubmit={login}
          onForgot={() => {
            setAuthMode("forgot");
            setPassword("");
            setMessage("");
          }}
          onSignup={() => {
            setAuthMode("signup");
            setPassword("");
            setMessage("");
          }}
          theme={theme}
          setTheme={chooseTheme}
          themePersisted={themePersisted}
        />
      ) : !session && authMode === "forgot" ? (
        <RecoveryReference
          email={email}
          setEmail={setEmail}
          busy={busy}
          onSubmit={forgot}
          message={message}
          onBack={() => {
            setAuthMode("login");
            setMessage("");
            setPassword("");
          }}
        />
      ) : !session ? (
        <>
          <section>
            <h2>{authMode === "signup" ? "ساخت حساب" : "بازیابی رمز عبور"}</h2>
            <form onSubmit={authMode === "signup" ? signup : forgot}>
              {authMode === "signup" && (
                <label>
                  نام
                  <input
                    autoComplete="name"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>
              )}
              <label>
                ایمیل
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {authMode === "signup" && (
                <label>
                  رمز عبور
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <button disabled={busy}>
                {authMode === "signup" ? "ثبت‌نام" : "ارسال پیوند بازیابی"}
              </button>
            </form>
            <button
              className="minor"
              disabled={busy}
              onClick={() => {
                setAuthMode("login");
                setMessage("");
                setPassword("");
              }}
            >
              بازگشت به ورود
            </button>
          </section>
          <ThemeSettings
            mode={theme}
            setMode={chooseTheme}
            persisted={themePersisted}
          />
        </>
      ) : (
        <>
          {page !== "calendar" &&
            page !== "shopping" &&
            page !== "documents" &&
            page !== "house" &&
            page !== "finance" &&
            page !== "search" &&
            page !== "settings" &&
            page !== "task-new" &&
            page !== "event-new" &&
            page !== "chores" && (
              <QuickAdd
                client={client}
                householdId={household ?? null}
                floating={page === "tasks"}
                onNewTask={() => {
                  setPage("task-new");
                  window.scrollTo(0, 0);
                }}
                onNewEvent={() => {
                  setNewEventDate(undefined);
                  setPage("event-new");
                  window.scrollTo(0, 0);
                }}
                onDone={() => setRevision((n) => n + 1)}
              />
            )}
          {page === "house" &&
            (household === undefined ? (
              <section>
                {householdError ? (
                  <>
                    <p role="alert">
                      دریافت اطلاعات خانه ناموفق بود؛ اتصال را بررسی کنید.
                    </p>
                    <button onClick={() => setHouseholdAttempt((n) => n + 1)}>
                      تلاش دوباره
                    </button>
                  </>
                ) : (
                  <p role="status">در حال دریافت اطلاعات خانه…</p>
                )}
              </section>
            ) : (
              <HomeDashboard
                key={household ?? "no-house"}
                client={client}
                userId={session.user.id}
                householdId={household}
                onHouseholdChange={setHousehold}
                onSettings={() => setPage("settings")}
                onTasks={() => setPage("tasks")}
                onCalendar={() => setPage("calendar")}
              />
            ))}
          {page === "shopping" && household && (
            <Shopping
              key={`${session.user.id}:${household}:${revision}`}
              client={client}
              householdId={household}
            />
          )}
          {page === "shopping" && household === null && (
            <section>
              <p>
                برای استفاده از لیست خرید ابتدا در بخش خانه یک خانه بسازید یا به
                آن بپیوندید.
              </p>
            </section>
          )}
          {household === undefined &&
            householdError &&
            page !== "house" &&
            page !== "finance" && (
              <section>
                <p role="alert">
                  وضعیت خانه دریافت نشد؛ اطلاعات مشترک ممکن است نمایش داده نشود.
                </p>
                <button
                  type="button"
                  onClick={() => setHouseholdAttempt((n) => n + 1)}
                >
                  تلاش دوباره
                </button>
              </section>
            )}
          {page === "tasks" && (
            <Today
              key={`today:${session.user.id}`}
              client={client}
              onTaskChanged={() => setRevision((n) => n + 1)}
              onNavigate={(target, section) => {
                if (section === "chore-list" && !household) {
                  setPage("house");
                  return;
                }
                if (section === "chore-list") {
                  setPage("chores");
                  window.scrollTo(0, 0);
                  return;
                }
                setPage(target);
                if (section)
                  window.requestAnimationFrame(() =>
                    (() => {
                      const target = document.getElementById(section);
                      const container = target?.closest("details");
                      if (container) container.open = true;
                      target?.scrollIntoView({ block: "start" });
                    })(),
                  );
                else window.scrollTo(0, 0);
              }}
            />
          )}
          {page === "tasks" && (
            <details className="today-ref-management">
              <summary>مدیریت همه کارها</summary>
              <Tasks
                key={`${session.user.id}:${household ?? "none"}:${revision}`}
                client={client}
                householdId={household ?? null}
                onNewTask={() => {
                  setPage("task-new");
                  window.scrollTo(0, 0);
                }}
              />
            </details>
          )}
          {page === "tasks" && household && (
            <details className="today-ref-management">
              <summary>مدیریت کارهای خانه</summary>
              <Chores key={household} client={client} householdId={household} />
            </details>
          )}
          {page === "chores" && household !== undefined && (
            <ChoresDashboard
              key={household ?? "none"}
              client={client}
              householdId={household}
              onSettings={() => setPage("settings")}
              onHouse={() => setPage("house")}
            />
          )}
          {page === "task-new" && (
            <NewTask
              key={session.user.id}
              client={client}
              userId={session.user.id}
              householdId={household ?? null}
              onDone={() => {
                setRevision((n) => n + 1);
                setPage("tasks");
                window.scrollTo(0, 0);
              }}
              onCancel={() => {
                setPage("tasks");
                window.scrollTo(0, 0);
              }}
            />
          )}
          {page === "event-new" && (
            <NewEvent
              key={session.user.id}
              client={client}
              userId={session.user.id}
              initialDate={newEventDate}
              householdId={household ?? null}
              onDone={() => {
                setRevision((n) => n + 1);
                setPage("calendar");
                window.scrollTo(0, 0);
              }}
              onCancel={() => {
                setPage("calendar");
                window.scrollTo(0, 0);
              }}
            />
          )}
          {page === "finance" && (
            <Finance
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
              onBack={() => setPage("house")}
              onSettings={() => setPage("settings")}
            />
          )}
          {page === "search" && (
            <Search
              key={session.user.id}
              client={client}
              userId={session.user.id}
              onNavigate={(kind) => {
                if (kind === "task" || kind === "chore") {
                  if (kind === "chore" && !household) {
                    setPage("house");
                    return;
                  }
                  setPage("tasks");
                  window.requestAnimationFrame(() => {
                    const target = document.getElementById(
                      kind === "task" ? "task-list" : "chore-list",
                    );
                    const container = target?.closest("details");
                    if (container) container.open = true;
                    target?.scrollIntoView({ block: "start" });
                  });
                } else
                  setPage(
                    (
                      {
                        event: "calendar",
                        shopping_item: "shopping",
                        finance: "finance",
                      } as const
                    )[kind],
                  );
              }}
            />
          )}
          {page === "documents" && (
            <Documents
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
              onBack={() => setPage("house")}
            />
          )}
          {page === "reminders" && (
            <Reminders
              key={session.user.id}
              client={client}
              notificationStatus={notificationStatus}
              householdId={household ?? null}
            />
          )}
          {page === "settings" && (
            <SettingsDashboard
              client={client}
              theme={theme}
              setTheme={chooseTheme}
              themePersisted={themePersisted}
              install={installState}
              notificationStatus={notificationStatus}
              backupInAccount
              onHouse={() => setPage("house")}
              onAccount={() => setPage("profile")}
            />
          )}
          {page === "profile" && (
            <>
              <ThemeSettings
                mode={theme}
                setMode={chooseTheme}
                persisted={themePersisted}
              />
              <InstallGuide state={installState} />
              <Profile key={session.user.id} client={client} />
              <PendingTransferPanel
                userId={session.user.id}
                householdId={household ?? null}
              />
              <ExportData key={`export:${session.user.id}`} client={client} />
            </>
          )}
          {page === "calendar" && (
            <CalendarEvents
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
              onHouse={() => setPage("house")}
              onNewEvent={(date) => {
                setNewEventDate(date);
                setPage("event-new");
                window.scrollTo(0, 0);
              }}
            />
          )}
          {page === "profile" && (
            <button
              className="minor"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const deviceId =
                    window.KhoonemoonNotifications?.stopBackground?.();
                  if (deviceId) {
                    // Offline sign-out still clears the local credential. The
                    // server credential expires after 30 days if revocation fails.
                    await Promise.race([
                      client.rpc("revoke_reminder_device", { p_id: deviceId }),
                      new Promise((resolve) =>
                        window.setTimeout(resolve, 4000),
                      ),
                    ]).catch(() => {});
                  }
                  if (
                    !window.KhoonemoonNotifications &&
                    "serviceWorker" in navigator
                  ) {
                    try {
                      const registration =
                        await navigator.serviceWorker.getRegistration();
                      if (registration)
                        await disableBrowserPush(client, registration);
                    } catch {
                      /* local logout remains available while offline */
                    }
                  }
                  const { error } = await client.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              خروج از حساب
            </button>
          )}
        </>
      )}
    </main>
  );
}

// Native Android already bundles its assets. Only the standalone web app
// registers a static-shell worker; it never caches Supabase/API responses.
if (
  !window.KhoonemoonNotifications &&
  "serviceWorker" in navigator &&
  window.isSecureContext
) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
createRoot(document.getElementById("root")!).render(<App />);
