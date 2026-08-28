"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toFinanceAmount } from "@/features/finance/status";
import type {
  FinanceMember,
  FinanceRecord,
  FinanceRecordType,
} from "@/features/finance/types";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { cn } from "@/shared/utils/cn";
import { formatAmount, toDateTimeLocal } from "./finance-display";
import { FinanceForm, type FinanceFormState } from "./finance-form";
import {
  filterFinanceRecords,
  summarizeFinanceRecords,
  type FinancePaidFilter,
  type FinanceTypeFilter,
} from "./finance-list";
import {
  buildCreateFinancePayload,
  buildPayAction,
  buildUnpayAction,
  buildUpdateAction,
  canStartFinanceMutation,
  validateFinanceFormClient,
} from "./finance-payload";
import { FinanceRecordCard } from "./finance-record-card";

type ListsResponse = {
  records?: FinanceRecord[];
  members?: Array<{
    user_id?: string;
    userId?: string;
    full_name?: string;
    fullName?: string;
  }>;
  householdId?: string | null;
  message?: string;
};

const emptyForm = (canShare: boolean): FinanceFormState => ({
  recordType: "EXPENSE",
  title: "",
  amount: "",
  currency: "IRR",
  visibility: canShare ? "HOUSEHOLD_SHARED" : "PRIVATE",
  dueAt: "",
  occurredAt: "",
  category: "",
  note: "",
});

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        selected
          ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

export function FinanceManager({
  householdId,
  initialMembers = [],
}: {
  householdId: string | null;
  userId?: string;
  initialMembers?: FinanceMember[];
}) {
  const router = useRouter();
  const [activeHouseholdId, setActiveHouseholdId] = useState(householdId);
  const canShare = Boolean(activeHouseholdId);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [members, setMembers] = useState<FinanceMember[]>(initialMembers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FinanceFormState>(() => emptyForm(canShare));
  const [typeFilter, setTypeFilter] = useState<FinanceTypeFilter>("ALL");
  const [paidFilter, setPaidFilter] = useState<FinancePaidFilter>("ALL");

  const patchForm = (patch: Partial<FinanceFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  async function loadRecords() {
    try {
      const response = await fetch("/api/finance", { cache: "no-store" });
      const data = (await response.json()) as ListsResponse;
      if (response.status === 401) {
        throw new Error("برای مشاهده موارد مالی باید وارد حساب شوید.");
      }
      if (!response.ok) {
        throw new Error(data.message || "بارگذاری موارد مالی ناموفق بود.");
      }
      setRecords(data.records ?? []);
      if (data.householdId !== undefined) {
        setActiveHouseholdId(data.householdId ?? null);
      }
      if (data.members?.length) {
        setMembers(
          data.members.map((row) => ({
            userId: row.userId ?? row.user_id ?? "",
            fullName: row.fullName ?? row.full_name ?? "کاربر",
          })),
        );
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "بارگذاری موارد مالی ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadRecords();
    }, 0);
    const hashTimer = window.setTimeout(() => {
      if (window.location.hash === "#quick-add-finance") {
        setShowForm(true);
      }
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      window.clearTimeout(hashTimer);
    };
  }, [householdId]);

  const visibleRecords = useMemo(
    () => filterFinanceRecords(records, typeFilter, paidFilter),
    [records, typeFilter, paidFilter],
  );
  const totals = useMemo(
    () => summarizeFinanceRecords(visibleRecords),
    [visibleRecords],
  );
  const bills = useMemo(
    () => visibleRecords.filter((record) => record.record_type === "BILL"),
    [visibleRecords],
  );
  const expenses = useMemo(
    () => visibleRecords.filter((record) => record.record_type === "EXPENSE"),
    [visibleRecords],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(canShare));
    setShowForm(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function openEdit(record: FinanceRecord) {
    setEditingId(record.id);
    setForm({
      recordType: record.record_type,
      title: record.title,
      amount: String(toFinanceAmount(record.amount)),
      currency: record.currency || "IRR",
      visibility: record.visibility,
      dueAt: toDateTimeLocal(record.due_at),
      occurredAt: toDateTimeLocal(record.occurred_at),
      category: record.category ?? "",
      note: record.note ?? "",
    });
    setShowForm(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm(canShare));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const type: FinanceRecordType = editingId
      ? (records.find((item) => item.id === editingId)?.record_type ?? form.recordType)
      : form.recordType;

    const clientError = validateFinanceFormClient(form, type);
    if (clientError) {
      setErrorMessage(clientError);
      return;
    }

    if (!canStartFinanceMutation(busyId)) return;

    setBusyId(editingId ?? "new");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = editingId
        ? await fetch(`/api/finance/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildUpdateAction(form, type)),
          })
        : await fetch("/api/finance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCreateFinancePayload(form, canShare)),
          });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "ذخیره مورد مالی ناموفق بود.");
      }

      setSuccessMessage(editingId ? "مورد مالی ویرایش شد." : "مورد مالی ثبت شد.");
      closeForm();
      await loadRecords();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ذخیره مورد مالی ناموفق بود.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function patchPaid(record: FinanceRecord, paid: boolean) {
    if (!canStartFinanceMutation(busyId)) return;
    setBusyId(record.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/finance/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paid ? buildPayAction() : buildUnpayAction()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "تغییر وضعیت پرداخت ناموفق بود.");
      }
      await loadRecords();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "تغییر وضعیت پرداخت ناموفق بود.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRecord(record: FinanceRecord) {
    if (!window.confirm(`«${record.title}» حذف شود؟`)) return;
    setBusyId(record.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/finance/${record.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "حذف مورد مالی ناموفق بود.");
      }
      if (editingId === record.id) closeForm();
      await loadRecords();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "حذف مورد مالی ناموفق بود.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div id="finance" className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            مالی
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            قبض‌ها و هزینه‌های یک‌بارهٔ شخصی یا مشترک خانه.
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          onClick={() => (showForm ? closeForm() : openCreate())}
        >
          <Plus className="size-4" />
          {showForm ? "بستن فرم" : "مورد جدید"}
        </Button>
      </section>

      {errorMessage ? (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <p>{errorMessage}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setLoading(true);
              void loadRecords();
            }}
          >
            تلاش دوباره
          </Button>
        </div>
      ) : null}
      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}

      {showForm ? (
        <FinanceForm
          state={form}
          setState={patchForm}
          canShare={canShare}
          isEditing={Boolean(editingId)}
          busy={busyId === "new" || busyId === editingId}
          onSubmit={(event) => void onSubmit(event)}
          onCancel={closeForm}
        />
      ) : (
        <div id="quick-add-finance" className="sr-only" />
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            selected={typeFilter === "ALL"}
            onClick={() => setTypeFilter("ALL")}
          >
            همه
          </FilterChip>
          <FilterChip
            selected={typeFilter === "BILL"}
            onClick={() => setTypeFilter("BILL")}
          >
            قبض
          </FilterChip>
          <FilterChip
            selected={typeFilter === "EXPENSE"}
            onClick={() => {
              setTypeFilter("EXPENSE");
              setPaidFilter("ALL");
            }}
          >
            هزینه
          </FilterChip>
        </div>
        {typeFilter !== "EXPENSE" ? (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              selected={paidFilter === "ALL"}
              onClick={() => setPaidFilter("ALL")}
            >
              همه وضعیت‌ها
            </FilterChip>
            <FilterChip
              selected={paidFilter === "UNPAID"}
              onClick={() => setPaidFilter("UNPAID")}
            >
              پرداخت‌نشده
            </FilterChip>
            <FilterChip
              selected={paidFilter === "PAID"}
              onClick={() => setPaidFilter("PAID")}
            >
              پرداخت‌شده
            </FilterChip>
          </div>
        ) : null}
      </div>

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری موارد مالی...
        </Card>
      ) : records.length === 0 && !errorMessage ? (
        <EmptyState
          title="هنوز مورد مالی ندارید"
          description="یک قبض با سررسید یا یک هزینه یک‌باره ثبت کنید."
        />
      ) : visibleRecords.length === 0 && !errorMessage ? (
        <EmptyState
          title="موردی با این فیلتر نیست"
          description="نوع یا وضعیت پرداخت را عوض کنید تا موارد دیگر دیده شوند."
        />
      ) : (
        <div className="min-w-0 space-y-4">
          {totals.length > 0 ? (
            <Card className="space-y-2">
              <CardTitle>جمع مبالغ</CardTitle>
              <CardDescription>بر اساس فیلتر فعلی.</CardDescription>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
                {totals.map((row) => (
                  <li key={row.currency} className="space-y-1">
                    <p>
                      قبض‌های پرداخت‌نشده:{" "}
                      {formatAmount(row.unpaidBills, row.currency)}
                    </p>
                    <p>هزینه‌ها: {formatAmount(row.expenses, row.currency)}</p>
                    <p>
                      قبض‌های پرداخت‌شده: {formatAmount(row.paidBills, row.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {bills.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                قبض‌ها
              </p>
              <ul className="space-y-2">
                {bills.map((record) => (
                  <li key={record.id}>
                    <FinanceRecordCard
                      record={record}
                      members={members}
                      busy={busyId === record.id}
                      onPay={() => void patchPaid(record, true)}
                      onUnpay={() => void patchPaid(record, false)}
                      onEdit={() => openEdit(record)}
                      onDelete={() => void deleteRecord(record)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {expenses.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                هزینه‌ها
              </p>
              <ul className="space-y-2">
                {expenses.map((record) => (
                  <li key={record.id}>
                    <FinanceRecordCard
                      record={record}
                      members={members}
                      busy={busyId === record.id}
                      onPay={() => undefined}
                      onUnpay={() => undefined}
                      onEdit={() => openEdit(record)}
                      onDelete={() => void deleteRecord(record)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
