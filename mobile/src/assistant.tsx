import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  CircleAlert,
  FileText,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import "./assistant.css";
import type { MobilePage } from "./navigation";

const suggestionPrompts = [
  "کارهای امروز من چیه؟",
  "قبض‌های نزدیک سررسید رو بگو",
  "برنامه غذایی این هفته چیه؟",
  "کدام مدرک‌ها تاریخ انقضای نزدیک دارند؟",
];
const destinations: {
  page: MobilePage;
  label: string;
  Icon: typeof ListTodo;
}[] = [
  { page: "shopping", label: "خرید", Icon: ShoppingBasket },
  { page: "calendar", label: "تقویم", Icon: CalendarDays },
  { page: "tasks", label: "کارها", Icon: ListTodo },
  { page: "meals", label: "برنامه غذایی", Icon: UtensilsCrossed },
  { page: "bills", label: "قبوض", Icon: ReceiptText },
  { page: "documents", label: "مدارک", Icon: FileText },
];

type AssistantAction = {
  type: "create_household_task" | "create_reminder" | "add_shopping_item";
  label: string;
  summary: string;
  token: string;
};
type EngineStatus =
  | "cloud_available"
  | "cloud_rate_limited"
  | "cloud_unavailable"
  | "cloud_timeout"
  | "cloud_model_disabled"
  | "internal_active";
type AssistantReply = {
  source?: "internal" | "cloud";
  status?: EngineStatus;
  cloudStatus?: EngineStatus;
  text?: string;
  action?: AssistantAction;
  message?: string;
};
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  status?: EngineStatus;
  cloudStatus?: EngineStatus;
  source?: "internal" | "cloud";
  action?: AssistantAction;
};

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function statusNote(message: ChatMessage) {
  if (message.role !== "assistant") return null;
  if (message.source === "cloud" && message.status === "cloud_available")
    return "تشخیص intent با مدل رایگان؛ داده‌ها و پاسخ از سرویس‌های خونمون";
  switch (message.cloudStatus) {
    case "cloud_rate_limited":
      return "سهمیهٔ رایگان در دسترس نیست؛ پاسخ از دستیار داخلی است.";
    case "cloud_timeout":
      return "مدل رایگان پاسخ نداد؛ پاسخ از دستیار داخلی است.";
    case "cloud_unavailable":
      return "مدل رایگان در دسترس نیست؛ پاسخ از دستیار داخلی است.";
    case "cloud_model_disabled":
      return "مدل ابری هنوز تأیید نشده؛ دستیار داخلی فعال است.";
    default:
      return "دستیار داخلی";
  }
}

function genericError() {
  return "دستیار فعلاً به سرویس خانه وصل نشد. اتصال را بررسی کن و دوباره تلاش کن؛ اطلاعاتی حدس زده نشده است.";
}

export function Assistant({
  client,
  onNavigate,
}: {
  client: SupabaseClient;
  onNavigate?: (page: MobilePage) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "سلام، من دستیار هوشمند خونمونم. می‌توانم اطلاعات ثبت‌شدهٔ کارها، تقویم، خرید، برنامهٔ غذایی، قبض‌ها، مدارک، تعمیرات و یادآورها را پیدا کنم.\n\nچه چیزی لازم داری؟",
      source: "internal",
      status: "internal_active",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowCloud, setAllowCloud] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function callAssistant(body: Record<string, unknown>) {
    const { data, error } = await client.functions.invoke<AssistantReply>(
      "assistant",
      { body },
    );
    if (error || !data) throw new Error("assistant_unavailable");
    return data;
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setMessages((current) => [...current, { id: id(), role: "user", text }]);
    try {
      const result = await callAssistant({
        mode: "message",
        message: text,
        allowCloud,
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran",
      });
      setMessages((current) => [
        ...current,
        {
          id: id(),
          role: "assistant",
          text: result.text || result.message || genericError(),
          status: result.status,
          cloudStatus: result.cloudStatus,
          source: result.source,
          action: result.action,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: id(),
          role: "assistant",
          text: genericError(),
          source: "internal",
          status: "internal_active",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(messageId: string, token: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await callAssistant({
        mode: "confirm",
        token,
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran",
      });
      setMessages((current) => [
        ...current.map((message) =>
          message.id === messageId
            ? { ...message, action: undefined }
            : message,
        ),
        {
          id: id(),
          role: "assistant",
          text: result.text || result.message || genericError(),
          source: "internal",
          status: "internal_active",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: id(),
          role: "assistant",
          text: "تأیید از سرور دریافت نشد. فعلاً دوباره نزن؛ ابتدا صفحهٔ مربوط را تازه کن و وضعیت را بررسی کن.",
          source: "internal",
          status: "internal_active",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <main className="assistant-ref" dir="rtl">
      <header className="assistant-hero">
        <button
          className="assistant-settings"
          type="button"
          aria-label="رفتن به تنظیمات"
          onClick={() => onNavigate?.("settings")}
        >
          <Sparkles size={20} aria-hidden="true" />
        </button>
        <div className="assistant-hero-art" aria-hidden="true">
          <MessageCircle size={29} strokeWidth={1.4} />
        </div>
        <p className="assistant-eyebrow">دفتر کوچک خانهٔ ما</p>
        <h1>دستیار هوشمند خونمون</h1>
        <p className="assistant-subtitle">
          همراهی آرام برای کارهای روزمرهٔ خانه
        </p>
        <span className="assistant-engine-pill">
          <span className="assistant-engine-dot" />
          دستیار داخلی فعال
        </span>
      </header>

      <section className="assistant-quick-links" aria-label="میان‌برهای خانه">
        <h2>
          <span>دسترسی سریع</span>
          <small>از همین‌جا ادامه بده</small>
        </h2>
        <div className="assistant-destination-grid">
          {destinations.map(({ page, label, Icon }) => (
            <button key={page} type="button" onClick={() => onNavigate?.(page)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="assistant-chat-paper" aria-label="گفت‌وگو با دستیار">
        <div className="assistant-chat-heading">
          <div>
            <h2>گفت‌وگوی خانه</h2>
            <p>پاسخ‌ها بر پایهٔ اطلاعاتی است که به آن دسترسی داری.</p>
          </div>
          <Bot size={24} aria-hidden="true" />
        </div>
        <div
          className="assistant-messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.map((message) => (
            <article
              className={`assistant-message ${message.role}`}
              key={message.id}
            >
              <div className="assistant-avatar" aria-hidden="true">
                {message.role === "assistant" ? (
                  <Bot size={19} />
                ) : (
                  <span>من</span>
                )}
              </div>
              <div className="assistant-message-content">
                <p className="assistant-message-name">
                  {message.role === "assistant" ? "خونمون" : "شما"}
                </p>
                <p className="assistant-bubble">{message.text}</p>
                {message.role === "assistant" && statusNote(message) && (
                  <span className="assistant-source-note">
                    {message.cloudStatus === "cloud_rate_limited" ||
                    message.cloudStatus === "cloud_timeout" ||
                    message.cloudStatus === "cloud_unavailable" ? (
                      <CircleAlert size={13} aria-hidden="true" />
                    ) : (
                      <Check size={13} aria-hidden="true" />
                    )}
                    {statusNote(message)}
                  </span>
                )}
                {message.action && (
                  <div className="assistant-action-card">
                    <p>{message.action.summary}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void confirmAction(message.id, message.action!.token)
                      }
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="assistant-spin" />
                      ) : (
                        <Check size={17} />
                      )}
                      {message.action.label}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {busy && (
            <p className="assistant-loading" role="status">
              <LoaderCircle size={17} className="assistant-spin" />
              در حال بررسی اطلاعات…
            </p>
          )}
          <div ref={endRef} />
        </div>

        {messages.length < 3 && (
          <div className="assistant-suggestions">
            <h3>
              <Sparkles size={15} aria-hidden="true" /> شاید این‌ها را بپرسی
            </h3>
            <div>
              {suggestionPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="assistant-privacy">
          <LockKeyhole size={15} aria-hidden="true" />
          <label>
            <input
              type="checkbox"
              checked={allowCloud}
              onChange={(event) => setAllowCloud(event.target.checked)}
            />
            <span>
              اگر مدل رایگان تأیید و فعال شود، اجازه می‌دهم فقط متن پرسشم برای
              تشخیص درخواست به سرویس بیرونی فرستاده شود. اطلاعات خانه ارسال
              نمی‌شود.
            </span>
          </label>
        </div>

        <form className="assistant-composer" onSubmit={submit}>
          <label className="assistant-sr" htmlFor="assistant-message">
            پیام برای دستیار
          </label>
          <input
            id="assistant-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="پیامت را اینجا بنویس…"
            autoComplete="off"
            maxLength={2000}
            disabled={busy}
          />
          <button
            type="submit"
            aria-label="فرستادن پیام"
            disabled={busy || !draft.trim()}
          >
            {busy ? (
              <LoaderCircle size={19} className="assistant-spin" />
            ) : (
              <ArrowUp size={20} />
            )}
          </button>
        </form>
        <p className="assistant-footer-note">
          گفت‌وگو فقط برای همین نوبت روی دستگاه می‌ماند؛ عملیات فقط پس از تأیید
          تو ثبت می‌شود.
        </p>
      </section>
    </main>
  );
}
