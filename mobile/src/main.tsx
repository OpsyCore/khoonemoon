/// <reference types="vite/client" />
import "@fontsource-variable/vazirmatn";
import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Home,
  ListTodo,
  CalendarDays,
  ShoppingBasket,
  Wallet,
  UserRound,
  Bell,
  FolderOpen,
} from "lucide-react";
import { createRoot } from "react-dom/client";
import { useDueReminderCount } from "./reminder-badge";
import { describeBadge, formatBadgeCount } from "@/shared/utils/badge-count";
import { useMobileNotifications } from "./notifications";
import { Documents } from "./documents";
import { Reminders } from "./reminders";
import { Shopping } from "./shopping";
import { Search } from "./search";
import { ExportData } from "./export";
import { WeeklySummary } from "./weekly-summary";
import { Today } from "./today";
import { QuickAdd } from "./quick-add";
import { loginSchema, signupSchema } from "@/features/auth/schemas";
import { ZodError } from "zod";
import {
  ANDROID_RECOVERY_REDIRECT,
  changeRecoveredPassword,
  requestRecovery,
} from "./recovery";
import { directHousehold } from "@/features/households/direct-client";
import { CalendarEvents } from "./calendar";
import { Tasks } from "./tasks";
import { Finance } from "./finance";
import { Chores } from "./chores";
import { Profile } from "./profile";
import { HouseholdDetails } from "./household-details";
import { ThemeSettings } from "./theme-settings";
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
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
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
        ?.setAttribute("content", resolved === "dark" ? "#26251e" : "#f4eddd");
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
  const [page, setPage] = useState<
    | "house"
    | "tasks"
    | "calendar"
    | "shopping"
    | "finance"
    | "profile"
    | "reminders"
    | "documents"
    | "search"
  >(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "reminders") return "reminders";
    if (params.get("page") === "finance") return "finance";
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<string | null | undefined>(
    undefined,
  );
  const [householdError, setHouseholdError] = useState(false);
  const [householdAttempt, setHouseholdAttempt] = useState(0);
  const [houseName, setHouseName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const houses = useMemo(() => (client ? directHousehold(client) : null), []);

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
  const badge = formatBadgeCount(dueCount ?? 0);

  useEffect(() => {
    // Clear the previous account’s data before loading the next account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHousehold(undefined);
    setJoinCode("");
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
  function createHouse(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!houses) throw new Error();
      setHousehold(await houses.create(houseName));
      setHouseName("");
    });
  }
  function joinHouse(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!houses) throw new Error();
      setHousehold(await houses.join(joinCode));
      setJoinCode("");
    });
  }

  return (
    <main>
      <header>
        <h1>خونه‌مون</h1>
        <p>دفتر کوچک خانه و خانوادهٔ ما</p>
        {session && (
          <button
            className="minor"
            type="button"
            onClick={() => setPage("search")}
          >
            جستجو
          </button>
        )}
      </header>

      {!online && (
        <p className="network-status" role="status">
          اتصال اینترنت برقرار نیست. داده‌های خانه و ذخیره تغییرات به اینترنت
          نیاز دارند.
        </p>
      )}
      {message && (
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
      ) : !session ? (
        <>
          <section>
            <h2>
              {authMode === "login"
                ? "ورود"
                : authMode === "signup"
                  ? "ساخت حساب"
                  : "بازیابی رمز عبور"}
            </h2>
            <form
              onSubmit={
                authMode === "login"
                  ? login
                  : authMode === "signup"
                    ? signup
                    : forgot
              }
            >
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
              {authMode !== "forgot" && (
                <label>
                  رمز عبور
                  <input
                    type="password"
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <button disabled={busy}>
                {authMode === "login"
                  ? "ورود"
                  : authMode === "signup"
                    ? "ثبت‌نام"
                    : "ارسال پیوند بازیابی"}
              </button>
            </form>
            <button
              className="minor"
              disabled={busy}
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setMessage("");
                setPassword("");
              }}
            >
              {authMode === "login" ? "ساخت حساب جدید" : "بازگشت به ورود"}
            </button>
            {authMode === "login" && (
              <button
                className="minor"
                disabled={busy}
                onClick={() => {
                  setAuthMode("forgot");
                  setPassword("");
                  setMessage("");
                }}
              >
                رمز عبور را فراموش کرده‌ام
              </button>
            )}
          </section>
          <ThemeSettings
            mode={theme}
            setMode={chooseTheme}
            persisted={themePersisted}
          />
        </>
      ) : (
        <>
          <QuickAdd
            client={client}
            householdId={household ?? null}
            onDone={() => setRevision((n) => n + 1)}
          />
          {page === "house" && (
            <section>
              <h2>خانه و اعضا</h2>
              {household === undefined ? (
                householdError ? (
                  <>
                    <p role="alert">
                      دریافت اطلاعات خانه ناموفق بود؛ اتصال را بررسی کنید.
                    </p>
                    <button
                      type="button"
                      onClick={() => setHouseholdAttempt((n) => n + 1)}
                    >
                      تلاش دوباره
                    </button>
                  </>
                ) : (
                  <p role="status">در حال دریافت اطلاعات خانه…</p>
                )
              ) : household ? (
                <HouseholdDetails
                  key={household}
                  client={client}
                  householdId={household}
                  userId={session.user.id}
                  onLeave={() => {
                    setHousehold(null);
                  }}
                />
              ) : (
                <>
                  <form onSubmit={createHouse}>
                    <label>
                      نام خانه
                      <input
                        value={houseName}
                        onChange={(e) => setHouseName(e.target.value)}
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <button disabled={busy}>ایجاد خانه</button>
                  </form>
                  <form onSubmit={joinHouse}>
                    <label>
                      کد دعوت
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        minLength={12}
                        maxLength={128}
                        required
                        dir="ltr"
                      />
                    </label>
                    <button disabled={busy}>پیوستن به خانه</button>
                  </form>
                </>
              )}
            </section>
          )}
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
          {household === undefined && householdError && page !== "house" && (
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
                setPage(target);
                if (section)
                  window.requestAnimationFrame(() =>
                    document
                      .getElementById(section)
                      ?.scrollIntoView({ block: "start" }),
                  );
                else window.scrollTo(0, 0);
              }}
            />
          )}
          {page === "tasks" && (
            <WeeklySummary key={`weekly:${session.user.id}`} client={client} />
          )}
          {page === "tasks" && (
            <Tasks
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
            />
          )}
          {page === "tasks" && household && (
            <Chores key={household} client={client} householdId={household} />
          )}
          {page === "finance" && (
            <Finance
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
            />
          )}
          {page === "search" && (
            <Search key={session.user.id} client={client} />
          )}
          {page === "documents" && (
            <Documents
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
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
          {page === "profile" && (
            <>
              <ThemeSettings
                mode={theme}
                setMode={chooseTheme}
                persisted={themePersisted}
              />
              <InstallGuide state={installState} />
              <Profile key={session.user.id} client={client} />
              <ExportData key={`export:${session.user.id}`} client={client} />
            </>
          )}
          {page === "calendar" && (
            <CalendarEvents
              key={`${session.user.id}:${household ?? "none"}:${revision}`}
              client={client}
              householdId={household ?? null}
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
                  const { error } = await client.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              خروج از حساب
            </button>
          )}
          <nav className="bottom-nav" aria-label="بخش‌های برنامه">
            {(
              [
                ["tasks", "کارها", ListTodo],
                ["calendar", "تقویم", CalendarDays],
                ["shopping", "خرید", ShoppingBasket],
                ["finance", "مالی", Wallet],
                ["house", "خانه", Home],
                ["documents", "مدارک", FolderOpen],
                ["reminders", "یادآور", Bell],
                ["profile", "حساب", UserRound],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-current={page === id ? "page" : undefined}
                aria-label={
                  id === "reminders" && dueCount
                    ? `${label}، ${describeBadge(dueCount)}`
                    : label
                }
                onClick={() => {
                  setPage(id);
                  window.scrollTo(0, 0);
                }}
              >
                <Icon size={20} aria-hidden="true" />
                {id === "reminders" && badge && (
                  <span className="reminder-badge" aria-hidden="true">
                    {badge}
                  </span>
                )}
                <span>{label}</span>
              </button>
            ))}
          </nav>
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
