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
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  Plus,
  Settings,
  UsersRound,
} from "lucide-react";
import { directAppliances } from "@/features/appliances/direct-client";
import {
  APPLIANCE_GROUP_LABELS,
  MAINTENANCE_KIND_LABELS,
  type ApplianceGroup,
  type ApplianceMaintenanceLog,
  type HomeApplianceRecord,
  type MaintenanceKind,
} from "@/features/appliances/types";
import { formatAmount } from "@/features/finance/bills";
import { loadHouseholdMembers } from "@/features/households/members";
import { directReminders } from "@/features/reminders/direct-client";
import type { TaskMember } from "@/features/tasks/types";
import { formatPersianDate } from "@/shared/utils/locale";
import "./appliances.css";

type DocOption = { id: string; title: string };

const INIT_FORM = {
  name: "",
  group: "APPLIANCE" as ApplianceGroup,
  brand: "",
  model: "",
  serialNumber: "",
  purchasedOn: "",
  warrantyUntil: "",
  lastServiceOn: "",
  nextServiceDate: "",
  intervalDays: "180",
  assigneeId: "",
  notes: "",
};

const INIT_LOG = {
  kind: "SERVICE" as MaintenanceKind,
  title: "",
  date: new Date().toISOString().slice(0, 10),
  cost: "",
  inFinance: true,
  docId: "",
  techName: "",
  techContact: "",
  notes: "",
};

export function Appliances({
  client,
  householdId,
  onDocuments,
  onFinance,
  onReminders,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onDocuments?: () => void;
  onFinance?: () => void;
  onReminders?: () => void;
}) {
  const api = useMemo(() => directAppliances(client), [client]);
  const [items, setItems] = useState<HomeApplianceRecord[]>([]);
  const [logs, setLogs] = useState<ApplianceMaintenanceLog[]>([]);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [members, setMembers] = useState<TaskMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [groupFilter, setGroupFilter] = useState<ApplianceGroup | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HomeApplianceRecord | null>(null);
  const [shared, setShared] = useState(Boolean(householdId));
  const [form, setForm] = useState(INIT_FORM);
  const [offsets, setOffsets] = useState<number[]>([10080, 1440]);
  const [servicing, setServicing] = useState<HomeApplianceRecord | null>(null);
  const [log, setLog] = useState(INIT_LOG);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const docPromise: Promise<DocOption[]> =
      typeof client.from === "function"
        ? Promise.resolve(
            client.from("documents").select("id,title").limit(500),
          ).then(
            (r) =>
              r.error || !Array.isArray(r.data) ? [] : (r.data as DocOption[]),
            () => [],
          )
        : Promise.resolve([]);
    const [a, l, d, m] = await Promise.all([
      api.list(),
      api.logs(),
      docPromise,
      householdId
        ? loadHouseholdMembers(client, householdId)
            .then(({ data }) =>
              data.map((member) => ({
                user_id: member.user_id,
                full_name: member.profiles?.[0]?.full_name ?? "کاربر",
              })),
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);
    setItems(a);
    setLogs(l);
    setDocs(d);
    setMembers(m);
    setLoaded(true);
  }, [api, client, householdId]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => {
      if (active) setMessage("دریافت اطلاعات وسایل و تعمیرات ناموفق بود.");
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => setNowMs(Date.now());
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, []);

  function resetForm() {
    setFormOpen(false);
    setEditing(null);
    setShared(Boolean(householdId));
    setForm(INIT_FORM);
  }

  function startEdit(x: HomeApplianceRecord) {
    setEditing(x);
    setShared(x.visibility === "HOUSEHOLD_SHARED");
    setForm({
      name: x.name,
      group: x.appliance_group,
      brand: x.brand ?? "",
      model: x.model ?? "",
      serialNumber: x.serial_number ?? "",
      purchasedOn: x.purchased_on ?? "",
      warrantyUntil: x.warranty_until ?? "",
      lastServiceOn: x.last_service_on ?? "",
      nextServiceDate: x.next_service_at ? x.next_service_at.slice(0, 10) : "",
      intervalDays: x.service_interval_days
        ? String(x.service_interval_days)
        : "",
      assigneeId: x.assignee_id ?? "",
      notes: x.notes ?? "",
    });
    setFormOpen(true);
  }

  async function saveAppliance(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const nextIso = form.nextServiceDate
        ? new Date(`${form.nextServiceDate}T09:00:00`).toISOString()
        : null;
      const payload = {
        name: form.name,
        visibility: shared && householdId ? "HOUSEHOLD_SHARED" : "PRIVATE",
        applianceGroup: form.group,
        brand: form.brand || null,
        model: form.model || null,
        serialNumber: form.serialNumber || null,
        purchasedOn: form.purchasedOn || null,
        warrantyUntil: form.warrantyUntil || null,
        lastServiceOn: form.lastServiceOn || null,
        nextServiceAt: nextIso,
        serviceIntervalDays: form.intervalDays
          ? Number(form.intervalDays)
          : null,
        assigneeId: shared && form.assigneeId ? form.assigneeId : null,
        notes: form.notes || null,
      };
      const saved = editing
        ? await api.update(editing.id, payload, editing.service_revision)
        : await api.create(payload);
      if (nextIso && offsets.length > 0) {
        const valid = offsets.filter(
          (m) => new Date(nextIso).getTime() - m * 60_000 > Date.now(),
        );
        if (valid.length > 0) {
          await directReminders(client)
            .create({
              targetType: "APPLIANCE",
              targetId: saved.id,
              baseDateTime: nextIso,
              offsets: valid.map((minutesBefore) => ({ minutesBefore })),
            })
            .catch(() => {});
          window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
        }
      }
      resetForm();
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "ذخیره اطلاعات وسیله ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitMaintenance(e: FormEvent) {
    e.preventDefault();
    if (!servicing) return;
    setBusy(true);
    setMessage("");
    try {
      const cost = log.cost.trim() ? Number(log.cost) : null;
      await api.recordMaintenance({
        applianceId: servicing.id,
        kind: log.kind,
        title: log.title,
        performedOn: log.date,
        costAmount: cost,
        recordInFinance: Boolean(cost && cost > 0 && log.inFinance),
        documentId: log.docId || null,
        technicianName: log.techName || null,
        technicianContact: log.techContact || null,
        notes: log.notes || null,
        reminderOffsetsMinutes: [10080, 1440],
      });
      setServicing(null);
      setLog(INIT_LOG);
      window.dispatchEvent(new Event("khoonemoon:reminders-changed"));
      window.dispatchEvent(new Event("khoonemoon:schedule-changed"));
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "ثبت سرویس یا تعمیر ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m.full_name])),
    [members],
  );
  const visible = items.filter(
    (x) => groupFilter === "ALL" || x.appliance_group === groupFilter,
  );
  const patchForm = (patch: Partial<typeof INIT_FORM>) =>
    setForm((p) => ({ ...p, ...patch }));
  const patchLog = (patch: Partial<typeof INIT_LOG>) =>
    setLog((p) => ({ ...p, ...patch }));

  return (
    <section className="appliances-screen" dir="rtl">
      <header className="appliances-hero">
        <h1>
          <Settings size={20} style={{ verticalAlign: "middle" }} /> وسایل و
          نگهداری خانه
        </h1>
        <p>مدیریت لوازم، تأسیسات، سرویس‌های دوره‌ای، تعمیرات و گارانتی‌ها</p>
      </header>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <div className="appliances-toolbar">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> افزودن وسیله
        </button>
        <select
          aria-label="فیلتر دسته وسایل"
          value={groupFilter}
          onChange={(e) =>
            setGroupFilter(e.target.value as ApplianceGroup | "ALL")
          }
        >
          <option value="ALL">همه دسته‌ها</option>
          {(
            Object.entries(APPLIANCE_GROUP_LABELS) as [ApplianceGroup, string][]
          ).map(([k, lbl]) => (
            <option key={k} value={k}>
              {lbl}
            </option>
          ))}
        </select>
        {onDocuments && (
          <button type="button" className="minor" onClick={onDocuments}>
            <FileText size={15} /> مدارک
          </button>
        )}
        {onFinance && (
          <button type="button" className="minor" onClick={onFinance}>
            مالی
          </button>
        )}
        {onReminders && (
          <button type="button" className="minor" onClick={onReminders}>
            یادآورها
          </button>
        )}
      </div>

      {formOpen && (
        <section className="appliances-panel">
          <h2>{editing ? "ویرایش وسیله" : "ثبت وسیله جدید"}</h2>
          <form onSubmit={(e) => void saveAppliance(e)}>
            <label>
              نام وسیله *
              <input
                required
                minLength={2}
                maxLength={180}
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
              />
            </label>
            <label>
              دسته
              <select
                value={form.group}
                onChange={(e) =>
                  patchForm({ group: e.target.value as ApplianceGroup })
                }
              >
                {(
                  Object.entries(APPLIANCE_GROUP_LABELS) as [
                    ApplianceGroup,
                    string,
                  ][]
                ).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["brand", "برند", "text"],
                ["model", "مدل", "text"],
                ["serialNumber", "شماره سریال", "text"],
                ["purchasedOn", "تاریخ خرید", "date"],
                ["warrantyUntil", "پایان گارانتی", "date"],
                ["lastServiceOn", "آخرین سرویس", "date"],
                ["nextServiceDate", "موعد سرویس بعدی", "date"],
                ["intervalDays", "دوره تکرار سرویس (روز)", "number"],
              ] as const
            ).map(([field, lbl, inputType]) => (
              <label key={field}>
                {lbl}
                <input
                  type={inputType}
                  value={form[field]}
                  onChange={(e) => patchForm({ [field]: e.target.value })}
                />
              </label>
            ))}
            {householdId && (
              <label className="item">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                />{" "}
                مشترک با خانه
              </label>
            )}
            {shared && householdId && members.length > 0 && (
              <label>
                مسئول پیگیری
                <select
                  value={form.assigneeId}
                  onChange={(e) => patchForm({ assigneeId: e.target.value })}
                >
                  <option value="">بدون مسئول مشخص</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              یادداشت
              <textarea
                maxLength={1000}
                rows={2}
                value={form.notes}
                onChange={(e) => patchForm({ notes: e.target.value })}
              />
            </label>
            {form.nextServiceDate && (
              <fieldset className="reminder-offsets">
                <legend>یادآور سرویس بعدی</legend>
                {(
                  [
                    [10080, "۷ روز قبل"],
                    [1440, "۱ روز قبل"],
                    [0, "روز سرویس"],
                  ] as const
                ).map(([mins, lbl]) => (
                  <label key={mins}>
                    <input
                      type="checkbox"
                      checked={offsets.includes(mins)}
                      onChange={(e) =>
                        setOffsets((p) =>
                          e.target.checked
                            ? [...p, mins]
                            : p.filter((x) => x !== mins),
                        )
                      }
                    />{" "}
                    {lbl}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="appliances-actions">
              <button disabled={busy}>ذخیره وسیله</button>
              <button type="button" className="minor" onClick={resetForm}>
                انصراف
              </button>
            </div>
          </form>
        </section>
      )}

      {servicing && (
        <section className="appliances-panel">
          <h2>ثبت سرویس یا تعمیر — {servicing.name}</h2>
          <form onSubmit={(e) => void submitMaintenance(e)}>
            <label>
              نوع اقدام
              <select
                value={log.kind}
                onChange={(e) =>
                  patchLog({ kind: e.target.value as MaintenanceKind })
                }
              >
                {(
                  Object.entries(MAINTENANCE_KIND_LABELS) as [
                    MaintenanceKind,
                    string,
                  ][]
                ).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </label>
            <label>
              شرح انجام‌شده *
              <input
                required
                minLength={2}
                maxLength={180}
                value={log.title}
                onChange={(e) => patchLog({ title: e.target.value })}
              />
            </label>
            <label>
              تاریخ انجام
              <input
                type="date"
                required
                value={log.date}
                onChange={(e) => patchLog({ date: e.target.value })}
              />
            </label>
            <label>
              هزینه (ریال)
              <input
                type="number"
                min="0"
                value={log.cost}
                onChange={(e) => patchLog({ cost: e.target.value })}
              />
            </label>
            {Number(log.cost) > 0 && (
              <label className="item">
                <input
                  type="checkbox"
                  checked={log.inFinance}
                  onChange={(e) => patchLog({ inFinance: e.target.checked })}
                />{" "}
                ثبت همزمان در هزینه‌های مالی
              </label>
            )}
            <label>
              تعمیرکار / شرکت
              <input
                maxLength={140}
                value={log.techName}
                onChange={(e) => patchLog({ techName: e.target.value })}
              />
            </label>
            <label>
              تماس تعمیرکار
              <input
                maxLength={140}
                value={log.techContact}
                onChange={(e) => patchLog({ techContact: e.target.value })}
              />
            </label>
            <label>
              فاکتور یا ضمانت‌نامه از مدارک
              <select
                value={log.docId}
                onChange={(e) => patchLog({ docId: e.target.value })}
              >
                <option value="">بدون پیوست مدرک</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              یادداشت
              <input
                maxLength={1000}
                value={log.notes}
                onChange={(e) => patchLog({ notes: e.target.value })}
              />
            </label>
            <div className="appliances-actions">
              <button disabled={busy}>
                <Check size={15} /> ثبت و محاسبه موعد بعد
              </button>
              <button
                type="button"
                className="minor"
                onClick={() => setServicing(null)}
              >
                انصراف
              </button>
            </div>
          </form>
        </section>
      )}

      {!loaded && !message && <p role="status">در حال دریافت وسایل…</p>}
      {loaded && visible.length === 0 && (
        <p>هنوز وسیله یا تجهیزاتی در این بخش ثبت نشده است.</p>
      )}

      {visible.map((item) => {
        const itemLogs = logs.filter((l) => l.appliance_id === item.id);
        const isDue =
          item.next_service_at &&
          new Date(item.next_service_at).getTime() <= nowMs;
        return (
          <article className="appliances-card" key={item.id}>
            <div className="appliances-card-head">
              <div>
                <strong>{item.name}</strong>
                {(item.brand || item.model) && (
                  <div>
                    <small>
                      {[item.brand, item.model].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                )}
              </div>
              <span className="appliances-badge">
                {item.visibility === "PRIVATE" ? (
                  <>
                    <LockKeyhole size={14} /> خصوصی
                  </>
                ) : (
                  <>
                    <UsersRound size={14} /> مشترک
                  </>
                )}
              </span>
            </div>
            <div className="appliances-badges">
              <span className="appliances-badge">
                {APPLIANCE_GROUP_LABELS[item.appliance_group]}
              </span>
              {item.next_service_at && (
                <span className={`appliances-badge ${isDue ? "due" : ""}`}>
                  <CalendarDays size={14} />{" "}
                  {isDue ? "سررسید سرویس: " : "سرویس بعدی: "}
                  {formatPersianDate(item.next_service_at)}
                </span>
              )}
              {item.service_interval_days && (
                <span className="appliances-badge">
                  <Clock3 size={14} /> هر{" "}
                  {item.service_interval_days.toLocaleString("fa-IR")} روز
                </span>
              )}
            </div>
            <div className="appliances-meta">
              {item.serial_number && <span>سریال: {item.serial_number}</span>}
              {item.purchased_on && (
                <span>خرید: {formatPersianDate(item.purchased_on)}</span>
              )}
              {item.warranty_until && (
                <span>
                  گارانتی تا: {formatPersianDate(item.warranty_until)}
                </span>
              )}
              {item.last_service_on && (
                <span>
                  آخرین سرویس: {formatPersianDate(item.last_service_on)}
                </span>
              )}
              {item.assignee_id && memberMap[item.assignee_id] && (
                <span>مسئول: {memberMap[item.assignee_id]}</span>
              )}
              {item.notes && <span>یادداشت: {item.notes}</span>}
            </div>
            <div className="appliances-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setServicing(item);
                  patchLog({ title: `سرویس ${item.name}` });
                }}
              >
                ثبت سرویس / تعمیر
              </button>
              <button
                type="button"
                className="minor"
                disabled={busy}
                onClick={() => startEdit(item)}
              >
                ویرایش
              </button>
              <button
                type="button"
                className="minor"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("این وسیله بایگانی شود؟")) return;
                  setBusy(true);
                  void api
                    .archive(item.id)
                    .then(load)
                    .catch(() => setMessage("بایگانی وسیله ناموفق بود."))
                    .finally(() => setBusy(false));
                }}
              >
                بایگانی
              </button>
            </div>
            {itemLogs.length > 0 && (
              <details className="appliances-logs">
                <summary>
                  سابقه سرویس و تعمیرات (
                  {itemLogs.length.toLocaleString("fa-IR")})
                </summary>
                <ul>
                  {itemLogs.map((l) => (
                    <li key={l.id}>
                      <strong>{l.title}</strong> (
                      {MAINTENANCE_KIND_LABELS[l.kind]}) ·{" "}
                      {formatPersianDate(l.performed_on)}
                      {l.cost_amount
                        ? ` · هزینه: ${formatAmount(l.cost_amount)}`
                        : ""}
                      {l.technician_name
                        ? ` · تعمیرکار: ${l.technician_name}`
                        : ""}
                      {l.technician_contact ? ` (${l.technician_contact})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
