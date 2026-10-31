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
import { useMobileNotifications } from "./notifications";
import { Documents } from "./documents";
import { Reminders } from "./reminders";
import { Shopping } from "./shopping";
import { signupSchema } from "@/features/auth/schemas";
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
  const [page, setPage] = useState<
    | "house"
    | "tasks"
    | "calendar"
    | "shopping"
    | "finance"
    | "profile"
    | "reminders"
    | "documents"
  >("tasks");
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!client);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(
    "login",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recovery, setRecovery] = useState(
    () => sessionStorage.getItem("khoonemoon:recovery") === "1",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<string | null | undefined>(
    undefined,
  );
  const [houseName, setHouseName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const houses = useMemo(() => (client ? directHousehold(client) : null), []);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setReady(true);
      }
    });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem("khoonemoon:recovery", "1");
        setRecovery(true);
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("khoonemoon:recovery");
        setRecovery(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

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

  useEffect(() => {
    // Clear the previous account’s data before loading the next account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHousehold(undefined);
    setJoinCode("");
    if (!userId || !client) return;
    let alive = true;
    void client
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .is("left_at", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage("دریافت اطلاعات خانه ناموفق بود.");
        else setHousehold(data?.household_id ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  async function action(fn: () => Promise<void>) {
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch {
      setMessage("عملیات انجام نشد؛ اطلاعات و اتصال اینترنت را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  function login(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      if (!client) throw new Error();
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
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
      setPassword("");
      setConfirmPassword("");
      sessionStorage.removeItem("khoonemoon:recovery");
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
        <p>نسخهٔ اندروید در حال ساخت</p>
      </header>

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
        <p>در حال آماده‌سازی…</p>
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
      ) : (
        <>
          {page === "house" && (
            <section>
              <h2>خانه و اعضا</h2>
              {household === undefined ? (
                <p>در حال دریافت اطلاعات خانه…</p>
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
              key={`${session.user.id}:${household}`}
              client={client}
              householdId={household}
            />
          )}
          {page === "shopping" && !household && (
            <section>
              <p>
                برای استفاده از لیست خرید ابتدا در بخش خانه یک خانه بسازید یا به
                آن بپیوندید.
              </p>
            </section>
          )}
          {page === "tasks" && (
            <Tasks
              key={`${session.user.id}:${household ?? "none"}`}
              client={client}
              householdId={household ?? null}
            />
          )}
          {page === "tasks" && household && (
            <Chores key={household} client={client} householdId={household} />
          )}
          {page === "finance" && (
            <Finance
              key={`${session.user.id}:${household ?? "none"}`}
              client={client}
              householdId={household ?? null}
            />
          )}
          {page === "documents" && (
            <Documents
              key={`${session.user.id}:${household ?? "none"}`}
              client={client}
              householdId={household ?? null}
            />
          )}
          {page === "reminders" && (
            <Reminders
              key={session.user.id}
              client={client}
              notificationStatus={notificationStatus}
            />
          )}
          {page === "profile" && (
            <Profile key={session.user.id} client={client} />
          )}
          {page === "calendar" && (
            <CalendarEvents
              key={`${session.user.id}:${household ?? "none"}`}
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
                onClick={() => {
                  setPage(id);
                  window.scrollTo(0, 0);
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
