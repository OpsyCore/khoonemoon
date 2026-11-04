import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  Clock3,
  FileDown,
  FileText,
  House,
  Info,
  Layers,
  Monitor,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Sun,
  Users,
} from "lucide-react";
import { directReminders } from "@/features/reminders/direct-client";
import { exportMobileData } from "@/features/export/direct-client";
import { exportFileName } from "@/features/export/archive";
import { BrowserPushSettings } from "./browser-push-settings";
import type { ThemeMode } from "./theme";
import type { useInstallPrompt } from "./install-guide";
import "./settings.css";

type Props = {
  client: SupabaseClient;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  themePersisted?: boolean;
  onHouse: () => void;
  onAccount: () => void;
  install: ReturnType<typeof useInstallPrompt>;
  notificationStatus?: string;
  accountExtra?: ReactNode;
  backupInAccount?: boolean;
};
function Heading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="settings-ref-heading">
      <span className="settings-ref-heading-icon">
        <Icon />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Row({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-ref-row">
      <span className="settings-ref-row-icon">
        <Icon />
      </span>
      <span className="settings-ref-row-text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {children}
    </div>
  );
}
export function SettingsDashboard({
  client,
  theme,
  setTheme,
  themePersisted = true,
  onHouse,
  onAccount,
  install,
  notificationStatus,
  accountExtra,
  backupInAccount = false,
}: Props) {
  const api = useMemo(() => directReminders(client), [client]);
  const [inApp, setInApp] = useState(true),
    [ready, setReady] = useState(false),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [native, setNative] = useState(false),
    [nativeEnabled, setNativeEnabled] = useState(false),
    [version, setVersion] = useState("");
  const [quiet, setQuiet] = useState(false),
    [start, setStart] = useState("22:00"),
    [end, setEnd] = useState("08:00"),
    [pushOpen, setPushOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void api
      .preferences()
      .then((p) => {
        if (!alive) return;
        setInApp(p?.in_app_enabled ?? true);
        setQuiet(p?.quiet_hours_enabled ?? false);
        setStart(p?.quiet_hours_start ?? "22:00");
        setEnd(p?.quiet_hours_end ?? "08:00");
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setReady(false);
          setMessage("دریافت تنظیمات اعلان ناموفق بود.");
        }
      });
    return () => {
      alive = false;
    };
  }, [api, reload]);
  useEffect(() => {
    const update = () => {
      const bridge = window.KhoonemoonNotifications;
      setNative(!!bridge);
      try {
        setNativeEnabled(!!bridge?.enabled());
        setVersion(bridge?.versionName?.() ?? "");
      } catch {
        setNativeEnabled(false);
        setVersion("");
      }
    };
    // Device capabilities cannot be read until after hydration.
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  async function toggleInApp() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const value = !inApp;
      await api.updateInApp(value);
      setInApp(value);
      window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
      setMessage("تنظیم یادآور ذخیره شد.");
    } catch {
      setReady(false);
      setMessage("ذخیره تأیید نشد؛ برای بررسی وضعیت دوباره دریافت کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function saveQuiet(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.updateQuietHours(
        quiet,
        quiet ? start : null,
        quiet ? end : null,
      );
      window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
      setMessage("ساعات سکوت ذخیره شد.");
      setReload((v) => v + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ذخیره ساعات سکوت تأیید نشد؛ زمان‌ها و اتصال را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download(format: "json" | "csv") {
    if (
      !window.confirm(
        "این خروجی حاوی اطلاعات حساس است. فایل را در محل امن ذخیره کنید. ادامه می‌دهید؟",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const now = new Date(),
        text = await exportMobileData(client, format, now),
        name = exportFileName({ extension: format, now }),
        mime = format === "csv" ? "text/csv" : "application/json";
      if (new TextEncoder().encode(text).length > 8 * 1024 * 1024)
        throw new Error("اندازه خروجی بیش از ۸ مگابایت است.");
      if (window.KhoonemoonNotifications) {
        if (!window.KhoonemoonNotifications.saveExport?.(name, mime, text))
          throw new Error("امکان باز کردن ذخیره‌ساز فایل وجود ندارد.");
        setMessage("محل ذخیره را در پنجره اندروید انتخاب کنید.");
      } else {
        const url = URL.createObjectURL(
          new Blob([text], { type: `${mime};charset=utf-8` }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage("درخواست ذخیره فایل ارسال شد.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "استخراج داده‌ها ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-ref" dir="rtl">
      <header className="settings-ref-header">
        <span className="settings-ref-sun" aria-hidden="true" />
        <span className="settings-ref-olive" aria-hidden="true" />
        <h1>تنظیمات</h1>
        <p>همه چیز، به سلیقه شما</p>
      </header>
      {message && (
        <p role="status" className="settings-ref-message">
          {message}
        </p>
      )}
      <section className="settings-ref-card">
        <Heading
          icon={Palette}
          title="ظاهر"
          subtitle="نمایش اپلیکیشن را مطابق سلیقه خود تنظیم کنید."
        />
        <div
          className="settings-ref-themes"
          role="group"
          aria-label="حالت نمایش"
        >
          {(
            [
              ["light", "حالت روشن", Sun],
              ["dark", "حالت تاریک", Moon],
              ["system", "حالت سیستم", Monitor],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              type="button"
              key={mode}
              aria-pressed={theme === mode}
              onClick={() => setTheme(mode)}
            >
              <Icon />
              <span>{label}</span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        {!themePersisted && <p role="status">تنظیم در این دستگاه ذخیره نشد.</p>}
      </section>
      <section className="settings-ref-card">
        <Heading
          icon={Bell}
          title="اعلان‌ها"
          subtitle="از رویدادهای مهم خانه باخبر بمانید."
        />
        <Row
          icon={Smartphone}
          title={native ? "مجوز اعلان اندروید" : "اعلان این مرورگر"}
          subtitle={
            native
              ? nativeEnabled
                ? "مجوز دستگاه فعال است؛ تحویل به سیستم و شبکه وابسته است."
                : "مجوز دستگاه فعال نیست."
              : "دریافت اعلان بیرون از برنامه به پشتیبانی مرورگر وابسته است."
          }
        >
          {native ? (
            <button
              type="button"
              className="settings-ref-link"
              onClick={() => window.KhoonemoonNotifications?.request()}
            >
              تنظیم مجوز
            </button>
          ) : (
            <button
              type="button"
              className="settings-ref-arrow"
              aria-expanded={pushOpen}
              aria-label="تنظیم اعلان مرورگر"
              onClick={() => setPushOpen(!pushOpen)}
            >
              <ChevronLeft />
            </button>
          )}
        </Row>
        {!native && pushOpen && (
          <div className="settings-ref-expanded">
            <BrowserPushSettings
              client={client}
              onChanged={() => setReload((v) => v + 1)}
            />
          </div>
        )}
        <Row
          icon={CalendarDays}
          title="یادآورهای درون‌برنامه‌ای"
          subtitle="در اندروید، زمان‌بندی اعلان محلی نیز به این تنظیم وابسته است."
        >
          {ready ? (
            <button
              type="button"
              role="switch"
              aria-label="یادآورهای درون‌برنامه‌ای"
              aria-checked={inApp}
              disabled={!ready || busy}
              className="settings-ref-switch"
              onClick={() => void toggleInApp()}
            >
              <span />
            </button>
          ) : (
            <span>نامشخص</span>
          )}
        </Row>
        {!ready && (
          <button
            type="button"
            className="settings-ref-link"
            onClick={() => setReload((v) => v + 1)}
          >
            دریافت دوباره تنظیمات
          </button>
        )}
        <details className="settings-ref-detail">
          <summary>
            <span className="settings-ref-row-icon">
              <Clock3 />
            </span>
            <span className="settings-ref-row-text">
              <strong>ساعات آرامش و تنظیمات اعلان‌ها</strong>
              <small>مدیریت زمان‌بندی یادآوری‌ها</small>
            </span>
            <ChevronLeft />
          </summary>
          <form className="settings-ref-expanded" onSubmit={saveQuiet}>
            <label>
              <input
                type="checkbox"
                checked={quiet}
                onChange={(e) => setQuiet(e.target.checked)}
              />{" "}
              فعال‌سازی ساعات سکوت
            </label>
            {quiet && (
              <div className="settings-ref-time">
                <label>
                  از ساعت
                  <input
                    type="time"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  تا ساعت
                  <input
                    type="time"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
            )}
            <p>
              اعلان اندروید از ساعت دستگاه و اعلان وب از منطقه زمانی پروفایل
              استفاده می‌کند. شبکه و محدودیت سیستم می‌توانند تحویل را به تأخیر
              بیندازند.
            </p>
            <button type="submit" disabled={busy || !ready}>
              ذخیره ساعات سکوت
            </button>
          </form>
        </details>
        {native && notificationStatus && (
          <p className="settings-ref-footnote">{notificationStatus}</p>
        )}
      </section>
      <section className="settings-ref-card settings-ref-family">
        <span className="settings-ref-family-art" aria-hidden="true" />
        <Heading
          icon={Users}
          title="خانوار"
          subtitle="مدیریت اعضای خانواده و دسترسی‌ها."
        />
        <Row
          icon={House}
          title="مدیریت خانوار"
          subtitle="دعوت اعضا و مدیریت خانه"
        >
          <button
            type="button"
            className="settings-ref-arrow"
            onClick={onHouse}
            aria-label="رفتن به مدیریت خانوار"
          >
            <ChevronLeft />
          </button>
        </Row>
        <Row
          icon={Users}
          title="مشاهده اعضای خانوار"
          subtitle="فهرست اعضا و نقش آن‌ها"
        >
          <button
            type="button"
            className="settings-ref-arrow"
            onClick={onHouse}
            aria-label="مشاهده اعضای خانوار"
          >
            <ChevronLeft />
          </button>
        </Row>
      </section>
      <section className="settings-ref-card">
        <Heading
          icon={Shield}
          title="داده‌ها و حریم خصوصی"
          subtitle="مالک داده‌های خود هستید."
        />
        <Row
          icon={FileDown}
          title="خروجی اطلاعات (JSON)"
          subtitle="گزیده داده‌های قابل مشاهده این حساب"
        >
          <button
            type="button"
            className="settings-ref-arrow"
            disabled={busy}
            onClick={() => void download("json")}
            aria-label="دریافت خروجی JSON"
          >
            <ChevronLeft />
          </button>
        </Row>
        <Row
          icon={FileText}
          title="خروجی دفتر مالی (CSV)"
          subtitle="دریافت رکوردهای مالی قابل مشاهده"
        >
          <button
            type="button"
            className="settings-ref-arrow"
            disabled={busy}
            onClick={() => void download("csv")}
            aria-label="دریافت خروجی CSV"
          >
            <ChevronLeft />
          </button>
        </Row>
        <p className="settings-ref-footnote">
          این خروجی‌ها پشتیبان کامل پروژه نیستند و فایل مدارک را شامل نمی‌شوند.
          {backupInAccount
            ? " گزینه‌های پشتیبان و بازیابی در حساب کاربری قرار دارند."
            : " گزینه‌های پشتیبان و بازیابی در نسخه اندروید قرار دارند."}
        </p>
        <button type="button" className="settings-ref-link" onClick={onAccount}>
          {backupInAccount ? "حساب کاربری و پشتیبان" : "حساب کاربری"}
        </button>
      </section>
      <section className="settings-ref-card settings-ref-app">
        <span className="settings-ref-flower" aria-hidden="true" />
        <Heading
          icon={SettingsIcon}
          title="برنامه"
          subtitle="اطلاعات و راهنماهای مربوط به اپلیکیشن."
        />
        <details className="settings-ref-detail">
          <summary>
            <span className="settings-ref-row-icon">
              <Smartphone />
            </span>
            <span className="settings-ref-row-text">
              <strong>راهنمای نصب PWA</strong>
              <small>استفاده از خونه‌مون روی صفحه اصلی دستگاه</small>
            </span>
            <ChevronLeft />
          </summary>
          <div className="settings-ref-expanded">
            <p>
              {native
                ? "نسخه اندروید مستقل نصب شده است."
                : "از گزینه نصب مرورگر یا منوی مرورگر و افزودن به صفحه اصلی استفاده کنید."}
            </p>
            {!native && install.available && !install.installed && (
              <button type="button" onClick={() => void install.install()}>
                نصب وب‌اپ
              </button>
            )}
            {install.message && <p role="status">{install.message}</p>}
            <p>داده‌های خصوصی و ثبت تغییرات به اینترنت نیاز دارند.</p>
          </div>
        </details>
        <details className="settings-ref-detail">
          <summary>
            <span className="settings-ref-row-icon">
              <Info />
            </span>
            <span className="settings-ref-row-text">
              <strong>درباره برنامه</strong>
              <small>معرفی و امکانات</small>
            </span>
            <ChevronLeft />
          </summary>
          <div className="settings-ref-expanded">
            <p>
              خونه‌مون برای هماهنگی کارها، تقویم، خرید، مالی، مدارک و یادآوری
              خانه ساخته شده است. اطلاعات براساس دسترسی حساب از Supabase دریافت
              می‌شوند.
            </p>
          </div>
        </details>
        <Row
          icon={Layers}
          title="نسخه برنامه"
          subtitle={
            native
              ? version
                ? `نسخه اندروید ${version}`
                : "نسخه نصب‌شده در این دستگاه مشخص نیست."
              : "نسخه وب؛ شماره نسخه مشخص نشده است."
          }
        >
          <span />
        </Row>
      </section>
      {accountExtra && (
        <section className="settings-ref-card">
          <Heading
            icon={Info}
            title="حساب کاربری"
            subtitle="مدیریت نشست فعلی"
          />
          {accountExtra}
        </section>
      )}
    </section>
  );
}
