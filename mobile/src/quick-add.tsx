import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { directTasks } from "@/features/tasks/direct-client";
import { directCalendar } from "@/features/calendar/direct-client";
import { directChores } from "@/features/chores/direct-client";
import { directShopping } from "@/features/shopping/direct-client";
import { directFinance } from "@/features/finance/direct-client";
import {
  buildQuickTaskPayload,
  buildQuickEventPayload,
  buildQuickChorePayload,
  buildQuickShoppingPayload,
  buildQuickBillPayload,
  buildQuickPayablePayload,
  defaultEventWindow,
  toDateTimeLocal,
  fromDateTimeLocal,
  parseAmount,
  type QuickAddKind,
} from "@/features/quick-add/payload";
import type { ShoppingList } from "@/features/shopping/types";
const labels: Record<QuickAddKind, string> = {
  task: "کار",
  event: "رویداد",
  shopping: "خرید",
  bill: "هزینه یا قبض",
  chore: "کار خانه",
};
export function QuickAdd({
  client,
  householdId,
  onDone,
  floating = false,
  onNewTask,
  onNewEvent,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onDone: () => void;
  floating?: boolean;
  onNewTask?: () => void;
  onNewEvent?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState<QuickAddKind>("task"),
    [title, setTitle] = useState(""),
    [shared, setShared] = useState(false),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState("IRR"),
    [due, setDue] = useState(""),
    [financialKind, setFinancialKind] = useState<"expense" | "bill">("expense");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(false);
  const [start, setStart] = useState(() =>
      toDateTimeLocal(defaultEventWindow(new Date()).start),
    ),
    [end, setEnd] = useState(() =>
      toDateTimeLocal(defaultEventWindow(new Date()).end),
    );
  const [lists, setLists] = useState<ShoppingList[]>([]),
    [listId, setListId] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      if (dialog && !dialog.open) dialog.showModal();
      typeRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);
  function closeDialog() {
    restoreFocus.current = true;
    setOpen(false);
  }
  useEffect(() => {
    if (!open || kind !== "shopping" || !householdId) return;
    let alive = true;
    void directShopping(client)
      .lists(householdId)
      .then((rows) => {
        if (alive) {
          setLists(rows);
          setListId(rows[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (alive) setMessage("دریافت لیست خرید ناموفق بود.");
      });
    return () => {
      alive = false;
    };
  }, [client, householdId, kind, open]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === "task" && onNewTask) {
      closeDialog();
      onNewTask();
      return;
    }
    if (kind === "event" && onNewEvent) {
      closeDialog();
      onNewEvent();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const visibility = householdId && shared ? "HOUSEHOLD_SHARED" : "PRIVATE";
      if (kind === "task")
        await directTasks(client).create(
          buildQuickTaskPayload({
            title,
            visibility,
            dueAt: fromDateTimeLocal(due),
          }),
        );
      else if (kind === "event") {
        const a = fromDateTimeLocal(start),
          b = fromDateTimeLocal(end);
        if (!a || !b) throw new Error("زمان رویداد را مشخص کنید.");
        await directCalendar(client).create(
          buildQuickEventPayload({ title, visibility, startAt: a, endAt: b }),
        );
      } else if (kind === "chore") {
        if (!householdId) throw new Error("ابتدا عضو یک خانه شوید.");
        await directChores(client).create(
          buildQuickChorePayload({ title, frequency: "WEEKLY" }),
        );
      } else if (kind === "shopping") {
        if (!householdId || !listId)
          throw new Error("ابتدا یک لیست خرید بسازید.");
        await directShopping(client).addItem(
          buildQuickShoppingPayload({ name: title, listId }),
        );
      } else {
        const parsed = parseAmount(amount);
        if (parsed === null) throw new Error("مبلغ معتبر وارد کنید.");
        const dueAt = fromDateTimeLocal(due);
        if (financialKind === "bill" && !dueAt)
          throw new Error("سررسید قبض را مشخص کنید.");
        await directFinance(client).create({
          ...(financialKind === "bill" && dueAt
            ? buildQuickPayablePayload({
                title,
                amount: parsed,
                visibility,
                dueAt,
              })
            : buildQuickBillPayload({ title, amount: parsed, visibility })),
          currency,
        });
      }
      setTitle("");
      setAmount("");
      setDue("");
      closeDialog();
      onDone();
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      setMessage("مورد ثبت شد.");
    } catch (error) {
      setMessage(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.")
          : error instanceof Error
            ? `${error.message} پیش از تلاش دوباره، فهرست مربوط را بررسی کنید.`
            : "ثبت تأیید نشد؛ پیش از تلاش دوباره فهرست مربوط را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={floating ? "today-quick-add" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={floating ? "today-quick-trigger" : "minor"}
        disabled={busy}
        aria-label={floating ? "افزودن سریع" : undefined}
        aria-controls="quick-add-form"
        onClick={() => {
          setOpen(!open);
          setMessage("");
        }}
        aria-expanded={open}
      >
        {floating ? "+" : "افزودن سریع"}
      </button>
      {!open && message && <p role="status">{message}</p>}
      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="quick-add-heading"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) closeDialog();
          }}
        >
          <form id="quick-add-form" onSubmit={submit}>
            <h2 id="quick-add-heading">افزودن سریع</h2>
            {message && <p role="alert">{message}</p>}
            <label>
              نوع
              <select
                ref={typeRef}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as QuickAddKind);
                  setMessage("");
                }}
              >
                {Object.entries(labels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {kind === "task" && onNewTask && (
              <button
                type="button"
                className="minor"
                onClick={() => {
                  closeDialog();
                  onNewTask();
                }}
              >
                تسک جدید
              </button>
            )}
            {kind === "event" && onNewEvent && (
              <button
                type="button"
                className="minor"
                onClick={() => {
                  closeDialog();
                  onNewEvent();
                }}
              >
                رویداد جدید
              </button>
            )}
            {!(
              (kind === "task" && onNewTask) ||
              (kind === "event" && onNewEvent)
            ) && (
              <>
                <label>
                  عنوان
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={2}
                    maxLength={180}
                  />
                </label>
                {(kind === "task" || kind === "event" || kind === "bill") &&
                  householdId && (
                    <label>
                      <span>مشترک با خانه</span>
                      <input
                        type="checkbox"
                        checked={shared}
                        onChange={(e) => setShared(e.target.checked)}
                      />
                    </label>
                  )}
                {kind === "task" && (
                  <label>
                    زمان دلخواه
                    <input
                      type="datetime-local"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                )}
                {kind === "event" && (
                  <>
                    <label>
                      شروع
                      <input
                        type="datetime-local"
                        required
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                      />
                    </label>
                    <label>
                      پایان
                      <input
                        type="datetime-local"
                        required
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                      />
                    </label>
                  </>
                )}
                {kind === "shopping" && (
                  <label>
                    لیست خرید
                    <select
                      required
                      value={listId}
                      onChange={(e) => setListId(e.target.value)}
                    >
                      <option value="">انتخاب لیست</option>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {kind === "bill" && (
                  <>
                    <label>
                      نوع مالی
                      <select
                        value={financialKind}
                        onChange={(e) =>
                          setFinancialKind(e.target.value as "expense" | "bill")
                        }
                      >
                        <option value="expense">هزینه پرداخت‌شده</option>
                        <option value="bill">قبض سررسیددار</option>
                      </select>
                    </label>
                    {financialKind === "bill" && (
                      <label>
                        سررسید قبض
                        <input
                          type="datetime-local"
                          required
                          value={due}
                          onChange={(e) => setDue(e.target.value)}
                        />
                      </label>
                    )}
                    <label>
                      مبلغ
                      <input
                        inputMode="decimal"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    <label>
                      واحد پول
                      <input
                        value={currency}
                        onChange={(e) =>
                          setCurrency(e.target.value.toUpperCase())
                        }
                        maxLength={3}
                        minLength={3}
                        required
                      />
                    </label>
                  </>
                )}
                {kind === "chore" && (
                  <p>
                    کار خانه به‌صورت هفتگی ثبت می‌شود؛ تنظیمات بیشتر در بخش
                    کارها در دسترس است.
                  </p>
                )}
                <button disabled={busy}>ثبت {labels[kind]}</button>
              </>
            )}
            <button
              type="button"
              className="minor"
              disabled={busy}
              onClick={closeDialog}
            >
              بستن
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
