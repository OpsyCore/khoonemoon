"use client";

import {
  CalendarPlus,
  ChevronRight,
  CircleCheckBig,
  Home,
  Loader2,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUICK_ADD_ENDPOINTS,
  buildQuickBillPayload,
  buildQuickChorePayload,
  buildQuickEventPayload,
  buildQuickShoppingPayload,
  buildQuickTaskPayload,
  defaultEventWindow,
  fromDateTimeLocal,
  parseAmount,
  successMessage,
  toDateTimeLocal,
  type QuickAddKind,
  type QuickVisibility,
} from "@/features/quick-add/payload";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

type Action = {
  key: QuickAddKind;
  label: string;
  hint: string;
  icon: typeof CircleCheckBig;
};

const ACTIONS: Action[] = [
  {
    key: "task",
    label: "تسک جدید",
    hint: "کار شخصی یا مشترک با موعد",
    icon: CircleCheckBig,
  },
  {
    key: "event",
    label: "رویداد جدید",
    hint: "قرار، ویزیت یا مهمانی",
    icon: CalendarPlus,
  },
  {
    key: "shopping",
    label: "آیتم خرید",
    hint: "افزودن سریع به لیست خرید",
    icon: ShoppingCart,
  },
  {
    key: "bill",
    label: "هزینه / قبض",
    hint: "ثبت پرداخت یا قبض",
    icon: Wallet,
  },
  {
    key: "chore",
    label: "کار خانه",
    hint: "کار تکرارشونده خانه",
    icon: Home,
  },
];

const VISIBILITY_OPTIONS: { value: QuickVisibility; label: string }[] = [
  { value: "HOUSEHOLD_SHARED", label: "مشترک خانه" },
  { value: "PRIVATE", label: "خصوصی" },
];

type ShoppingList = { id: string; name: string };

export function QuickAddSheet({
  onClose,
  hasHousehold,
}: {
  onClose: () => void;
  hasHousehold: boolean;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<QuickAddKind | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  // Default to the next full hour so "event" can be submitted immediately.
  const [dueAt, setDueAt] = useState(() =>
    toDateTimeLocal(defaultEventWindow(new Date()).start),
  );
  const [visibility, setVisibility] = useState<QuickVisibility>(
    hasHousehold ? "HOUSEHOLD_SHARED" : "PRIVATE",
  );
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">(
    "WEEKLY",
  );
  const [lists, setLists] = useState<ShoppingList[] | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const eventWindow = useMemo(() => defaultEventWindow(new Date()), []);

  useEffect(() => {
    if (kind !== "shopping" || lists !== null) return;

    const load = async () => {
      const response = await fetch("/api/shopping/lists");
      if (!response.ok) {
        setLists([]);
        return;
      }

      const payload = (await response.json()) as { lists: ShoppingList[] };
      setLists(payload.lists);
      setListId((current) => current ?? payload.lists[0]?.id ?? null);
    };

    void load();
  }, [kind, lists]);

  // Escape closes the sheet, matching native dialog expectations.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const needsHousehold = kind === "chore" || kind === "shopping";

  const submit = async () => {
    if (!kind) return;

    if (title.trim().length < 2) {
      setErrorMessage("عنوان را کامل وارد کنید (حداقل ۲ کاراکتر).");
      return;
    }

    if (needsHousehold && !hasHousehold) {
      setErrorMessage(
        "برای این بخش باید عضو یک خانه باشید. ابتدا در صفحه «خونه» خانه بسازید.",
      );
      return;
    }

    if (kind === "shopping" && !listId) {
      setErrorMessage(
        "لیست خریدی وجود ندارد. ابتدا در صفحه «لیست‌ها» یک لیست بسازید.",
      );
      return;
    }

    let body: unknown;

    if (kind === "task") {
      body = buildQuickTaskPayload({
        title,
        visibility,
        dueAt: fromDateTimeLocal(dueAt),
      });
    } else if (kind === "event") {
      const startAt =
        fromDateTimeLocal(dueAt) ?? eventWindow.start.toISOString();
      const end = new Date(new Date(startAt).getTime() + 60 * 60 * 1000);
      body = buildQuickEventPayload({
        title,
        visibility,
        startAt,
        endAt: dueAt ? end.toISOString() : eventWindow.end.toISOString(),
      });
    } else if (kind === "shopping") {
      body = buildQuickShoppingPayload({
        name: title,
        listId: listId as string,
      });
    } else if (kind === "bill") {
      const parsedAmount = parseAmount(amount);

      if (parsedAmount === null) {
        setErrorMessage("مبلغ را به عدد وارد کنید.");
        return;
      }

      body = buildQuickBillPayload({
        title,
        amount: parsedAmount,
        visibility,
        dueAt: fromDateTimeLocal(dueAt),
      });
    } else {
      body = buildQuickChorePayload({ title, frequency });
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(QUICK_ADD_ENDPOINTS[kind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        setErrorMessage(
          payload?.message ??
            "ثبت ناموفق بود. اتصال و دسترسی خود را بررسی کنید.",
        );
        return;
      }

      setSuccessText(successMessage(kind).message);
      setTitle("");
      setAmount("");
      router.refresh();
    } catch {
      setErrorMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAction = ACTIONS.find((action) => action.key === kind) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="افزودن سریع"
      className="fixed inset-0 z-50 bg-zinc-900/40 motion-safe:animate-[fade-in_120ms_ease-out]"
      onClick={onClose}
    >
      <section
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl motion-safe:animate-[sheet-up_160ms_ease-out] dark:border-zinc-800 dark:bg-zinc-900 md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:w-96 md:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {activeAction ? (
              <button
                type="button"
                onClick={() => {
                  setKind(null);
                  setErrorMessage(null);
                  setSuccessText(null);
                }}
                aria-label="بازگشت به انتخاب نوع"
                className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="size-4" />
              </button>
            ) : null}
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeAction ? activeAction.label : "افزودن سریع"}
            </h2>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            بستن
          </Button>
        </div>

        {successText ? (
          <p className="mb-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {successText}
          </p>
        ) : null}

        {!activeAction ? (
          <ul className="space-y-2">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const disabled =
                (action.key === "chore" || action.key === "shopping") &&
                !hasHousehold;

              return (
                <li key={action.key}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setKind(action.key);
                      setErrorMessage(null);
                      setSuccessText(null);
                      setTimeout(() => titleRef.current?.focus(), 50);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-right transition",
                      disabled
                        ? "cursor-not-allowed border-zinc-200 opacity-50 dark:border-zinc-800"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
                    )}
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {action.label}
                      </span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {disabled ? "نیازمند عضویت در یک خانه" : action.hint}
                      </span>
                    </span>
                    <Icon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-3">
            <Input
              ref={titleRef}
              label={kind === "shopping" ? "نام آیتم" : "عنوان"}
              placeholder={
                kind === "shopping"
                  ? "مثلاً: شیر"
                  : kind === "bill"
                    ? "مثلاً: قبض برق"
                    : "عنوان را بنویسید"
              }
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
            />

            {kind === "bill" ? (
              <Input
                label="مبلغ (ریال)"
                inputMode="numeric"
                placeholder="مثلاً: ۴۵۰۰۰۰"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            ) : null}

            {kind === "shopping" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  لیست
                </p>
                {lists === null ? (
                  <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="size-3 animate-spin" />
                    در حال دریافت لیست‌ها...
                  </p>
                ) : lists.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    لیستی وجود ندارد. در صفحه «لیست‌ها» یک لیست خرید بسازید.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lists.map((list) => (
                      <Button
                        key={list.id}
                        size="sm"
                        variant={list.id === listId ? "secondary" : "ghost"}
                        onClick={() => setListId(list.id)}
                      >
                        {list.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {kind === "chore" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  تکرار
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["DAILY", "هر روز"],
                      ["WEEKLY", "هفتگی"],
                      ["MONTHLY", "ماهانه"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={frequency === value ? "secondary" : "ghost"}
                      onClick={() => setFrequency(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {kind === "task" || kind === "bill" || kind === "event" ? (
              <Input
                label={kind === "bill" ? "سررسید (اختیاری)" : "موعد (اختیاری)"}
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            ) : null}

            {kind === "task" || kind === "event" || kind === "bill" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  دسترسی
                </p>
                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const disabled =
                      option.value === "HOUSEHOLD_SHARED" && !hasHousehold;

                    return (
                      <Button
                        key={option.value}
                        size="sm"
                        disabled={disabled}
                        variant={
                          visibility === option.value ? "secondary" : "ghost"
                        }
                        onClick={() => setVisibility(option.value)}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                  {!hasHousehold ? (
                    <Badge tone="neutral">بدون خانه: فقط خصوصی</Badge>
                  ) : null}
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errorMessage}
              </p>
            ) : null}

            <Button
              className="w-full"
              onClick={() => void submit()}
              isLoading={isSubmitting}
            >
              افزودن
            </Button>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          برای گزینه‌های بیشتر (تکرار، مسئول، توضیحات) از صفحه مربوطه استفاده
          کنید.
        </p>
      </section>
    </div>
  );
}
