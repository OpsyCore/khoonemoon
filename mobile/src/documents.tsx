import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  LockKeyhole,
  MoreVertical,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import "./documents.css";
import {
  directDocuments,
  type MobileDocument,
} from "@/features/documents/direct-client";
import {
  DOCUMENT_ENTITY_LABELS,
  type DocumentEntityType,
  type DocumentAttachment,
} from "@/features/documents/types";
import { formatPersianDate } from "@/shared/utils/locale";
const cats = {
  ALL: "همه",
  IDENTITY: "شناسنامه‌ای",
  FINANCE: "مالی",
  HOME: "خانه",
  TRAVEL: "سفر",
  OTHER: "سایر",
} as const;
type Category = keyof typeof cats;
export function Documents({
  client,
  householdId,
  onBack,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onBack?: () => void;
}) {
  const api = useMemo(() => directDocuments(client), [client]);
  const [items, setItems] = useState<MobileDocument[]>([]);
  const [category, setCategory] = useState<Category>("ALL");
  const [query, setQuery] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState(false);
  useEffect(() => {
    if (form)
      formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [form]);
  const [editing, setEditing] = useState<MobileDocument | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Exclude<Category, "ALL">>("OTHER");
  const [shared, setShared] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState<MobileDocument | null>(null);
  const [links, setLinks] = useState<DocumentAttachment[]>([]);
  const [linkType, setLinkType] = useState<DocumentEntityType>("TASK");
  const [targets, setTargets] = useState<{ id: string; title: string }[]>([]);
  const [target, setTarget] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [orphans, setOrphans] = useState<
    { path: string; uploaded_at: string }[] | null
  >(null);
  const [sharedResult, setSharedResult] = useState<{
    householdId: string;
    rows: { path: string; uploaded_at: string }[];
  } | null>(null);
  const sharedOrphans =
    sharedResult?.householdId === householdId ? sharedResult.rows : null;
  async function scanSharedOrphans() {
    if (!householdId) return;
    setBusy(true);
    setError("");
    try {
      setSharedResult({
        householdId,
        rows: await api.possibleSharedOrphans(householdId),
      });
    } catch (error) {
      setSharedResult(null);
      setError(
        error instanceof Error
          ? error.message
          : "بررسی فایل‌های مشترک ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cleanOrphan(path: string, shared: boolean) {
    if (
      !window.confirm(
        "این فایل احتمالاً بی‌مرجع برای همیشه حذف شود؟ اگر به آن نیاز دارید، انصراف دهید. این کار برگشت‌پذیر نیست.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.cleanPossibleOrphan(path);
      if (shared && householdId)
        setSharedResult({
          householdId,
          rows: await api.possibleSharedOrphans(householdId),
        });
      else setOrphans(await api.possibleOrphans());
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "نتیجهٔ پاک‌سازی تأیید نشد.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function scanOrphans() {
    setBusy(true);
    setError("");
    try {
      setOrphans(await api.possibleOrphans());
    } catch {
      setOrphans(null);
      setError("بررسی فایل‌های احتمالی ناموفق بود؛ اتصال را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  const load = useCallback(async () => {
    const data = await api.list();
    setItems(data);
    setLoaded(true);
  }, [api]);
  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((data) => {
        if (active) {
          setItems(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError("دریافت مدارک ناموفق بود؛ اتصال را بررسی کنید.");
      });
    return () => {
      active = false;
    };
  }, [api]);
  function reset() {
    setForm(false);
    setEditing(null);
    setTitle("");
    setDescription("");
    setKind("OTHER");
    setShared(false);
    setFile(null);
  }
  function edit(row: MobileDocument) {
    setEditing(row);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setKind(row.category);
    setShared(row.visibility === "HOUSEHOLD_SHARED");
    setForm(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) await api.update(editing.id, title, description, kind);
      else {
        if (!file) throw new Error("فایل را انتخاب کنید.");
        await api.create({
          file,
          title,
          description,
          visibility: shared ? "HOUSEHOLD_SHARED" : "PRIVATE",
          category: kind,
        });
      }
      reset();
      try {
        await load();
      } catch {
        setError("ذخیره انجام شد؛ تازه‌سازی فهرست ناموفق بود.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function open(row: MobileDocument) {
    setBusy(true);
    setError("");
    try {
      const url = await api.signedUrl(row);
      window.location.assign(url);
    } catch {
      setError("باز کردن مدرک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function manageLinks(
    row: MobileDocument,
    type: DocumentEntityType = "TASK",
  ) {
    setBusy(true);
    setError("");
    setTarget("");
    try {
      const [existing, choices] = await Promise.all([
        api.attachments(row.id),
        api.targets(type),
      ]);
      setLinks(existing);
      setTargets(choices);
      setLinkType(type);
      setLinking(row);
    } catch {
      setError("دریافت پیوندها ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: MobileDocument) {
    if (!window.confirm("این مدرک و فایل آن حذف شوند؟")) return;
    setBusy(true);
    setError("");
    try {
      await api.remove(row);
      try {
        await load();
      } catch {
        setItems([]);
        setLoaded(false);
        setError("مدرک حذف شد اما تازه‌سازی ناموفق بود؛ فهرست را تازه کنید.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف مدرک ناموفق بود.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (x) =>
      (category === "ALL" || x.category === category) &&
      `${x.title} ${x.description ?? ""}`.includes(query.trim()),
  );
  return (
    <div className="docs-ref" dir="rtl">
      <div className="docs-hero">
        <span className="docs-books" aria-hidden="true" />
        {onBack && (
          <button
            type="button"
            className="docs-back"
            aria-label="بازگشت به خانه"
            onClick={onBack}
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h2>مدارک ما</h2>
        <p>همه مدارک مهم زندگی‌مان، در یک جای امن</p>
        <span className="docs-quote">
          آرامش
          <br />
          در کنار هم <b>♥</b>
        </span>
      </div>
      <label className="docs-search">
        <span className="docs-sr">جستجوی مدارک</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی مدارک..."
        />
        <Search size={23} aria-hidden="true" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="minor"
            disabled={busy}
            onClick={() => {
              setError("");
              void load().catch(() => setError("دریافت مدارک ناموفق بود."));
            }}
          >
            تلاش دوباره
          </button>
        </p>
      )}
      {form && (
        <section className="docs-form" ref={formRef}>
          <h3>{editing ? "ویرایش مدرک" : "افزودن مدرک"}</h3>
          <form onSubmit={(e) => void save(e)}>
            <label>
              عنوان
              <input
                required
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              دسته
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as Exclude<Category, "ALL">)
                }
              >
                {Object.entries(cats)
                  .filter(([k]) => k !== "ALL")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              توضیحات
              <input
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {!editing && (
              <>
                <label>
                  فایل (PDF یا تصویر، حداکثر ۱۰ مگابایت)
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
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
              </>
            )}
            <button disabled={busy}>ذخیره مدرک</button>
            <button type="button" className="minor" onClick={reset}>
              انصراف
            </button>
          </form>
        </section>
      )}
      {linking && (
        <section className="docs-form">
          <h3>پیوندهای {linking.title}</h3>
          <p>فقط مواردی که به آنها دسترسی دارید نمایش داده می‌شوند.</p>
          <ul>
            {links.map((link) => (
              <li key={link.id}>
                <span>
                  {DOCUMENT_ENTITY_LABELS[link.entity_type]} · {link.entity_id}
                </span>
                <button
                  className="minor"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("پیوند حذف شود؟")) {
                      setBusy(true);
                      void api
                        .detach(link.id)
                        .then(() => manageLinks(linking, linkType))
                        .catch(() => setError("حذف پیوند ناموفق بود."))
                        .finally(() => setBusy(false));
                    }
                  }}
                >
                  حذف پیوند
                </button>
              </li>
            ))}
          </ul>
          <label>
            نوع مورد
            <select
              value={linkType}
              onChange={(e) =>
                void manageLinks(linking, e.target.value as DocumentEntityType)
              }
            >
              {Object.entries(DOCUMENT_ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            مورد
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !target}
            onClick={() => {
              setBusy(true);
              void api
                .attach(linking.id, linkType, target)
                .then(() => manageLinks(linking, linkType))
                .catch(() =>
                  setError(
                    "ثبت پیوند ناموفق بود؛ دسترسی و تکراری نبودن آن را بررسی کنید.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            افزودن پیوند
          </button>
          <button className="minor" onClick={() => setLinking(null)}>
            بستن
          </button>
        </section>
      )}
      <div className="docs-tabs" role="group" aria-label="دسته مدارک">
        {Object.entries(cats).map(([key, label]) => {
          return (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key as Category)}
            >
              <span
                className={`docs-type-icon docs-icon-${key}`}
                aria-hidden="true"
              />
              {label}
            </button>
          );
        })}
      </div>
      {!loaded && !error && <p role="status">در حال دریافت مدارک…</p>}
      {!loaded && error && (
        <button
          type="button"
          className="minor"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load()
              .then(() => setError(""))
              .catch(() =>
                setError("دریافت مدارک ناموفق بود؛ اتصال را بررسی کنید."),
              )
              .finally(() => setBusy(false));
          }}
        >
          تلاش دوباره
        </button>
      )}
      <div className="docs-list">
        {visible.map((row) => {
          return (
            <article className="docs-card" key={row.id}>
              <details className="docs-menu">
                <summary aria-label={`عملیات ${row.title}`}>
                  <MoreVertical size={22} />
                </summary>
                <div>
                  <button disabled={busy} onClick={() => void open(row)}>
                    باز کردن
                  </button>
                  <button disabled={busy} onClick={() => edit(row)}>
                    ویرایش
                  </button>
                  <button disabled={busy} onClick={() => void manageLinks(row)}>
                    پیوندها
                  </button>
                  <button disabled={busy} onClick={() => void remove(row)}>
                    حذف
                  </button>
                </div>
              </details>
              <span
                className={`docs-visibility ${row.visibility === "PRIVATE" ? "private" : "shared"}`}
              >
                {row.visibility === "PRIVATE" ? (
                  <>
                    <LockKeyhole size={16} /> خصوصی
                  </>
                ) : (
                  <>
                    <UsersRound size={16} /> مشترک
                  </>
                )}
              </span>
              <div className="docs-copy">
                <strong>{row.title}</strong>
                <span>{cats[row.category] ?? "سایر"}</span>
                <small>
                  {formatPersianDate(row.created_at)} ·{" "}
                  {(row.file_size / 1048576).toLocaleString("fa-IR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  مگابایت
                </small>
                {row.description && <small>{row.description}</small>}
              </div>
              <span className="docs-card-icon">
                <span
                  className={`docs-type-icon docs-icon-${row.category}`}
                  aria-hidden="true"
                />
              </span>
            </article>
          );
        })}
      </div>
      {loaded && items.length > 0 && visible.length === 0 && (
        <p className="docs-no-results">مدرکی با این جستجو یا دسته پیدا نشد.</p>
      )}
      {loaded && items.length === 0 && (
        <div className="docs-empty">
          <span className="docs-paper" aria-hidden="true" />
          <strong>هنوز مدرکی اضافه نکرده‌اید</strong>
          <p>
            مدارک مهم زندگی مشترک‌تان را اینجا نگه دارید تا همیشه در دسترس و امن
            باشند.
          </p>
        </div>
      )}
      <div className="docs-footer">
        <span className="docs-leaf docs-leaf-left" aria-hidden="true" />
        <span className="docs-leaf docs-leaf-right" aria-hidden="true" />
        <button
          type="button"
          className="docs-add"
          disabled={!loaded || busy}
          onClick={() => {
            reset();
            setForm(true);
          }}
        >
          <span>
            <Plus size={27} />
          </span>
          <div>
            <strong>افزودن مدرک</strong>
            <small>PDF، PNG، JPG و WEBP</small>
          </div>
        </button>
      </div>
      <details className="docs-cleanup">
        <summary>بررسی فایل‌های احتمالی بدون مدرک</summary>
        <p>
          فایل‌هایی را که بیش از هفت روز تغییر نکرده‌اند و مدرک ثبت‌شده‌ای
          ندارند بررسی کنید. نتیجه قطعی نیست؛ حذف فقط با تأیید جداگانهٔ شما
          انجام می‌شود و برگشت‌پذیر نیست. فایل‌های مشترک را فقط مالک فعلی خانه
          می‌تواند بررسی و پاک‌سازی کند.
        </p>
        <button
          type="button"
          className="minor"
          disabled={busy}
          onClick={() => void scanOrphans()}
        >
          بررسی فایل‌های خصوصی من
        </button>{" "}
        {householdId && (
          <button
            type="button"
            className="minor"
            disabled={busy}
            onClick={() => void scanSharedOrphans()}
          >
            بررسی فایل‌های مشترک خانه
          </button>
        )}
        {orphans &&
          (orphans.length === 0 ? (
            <p role="status">موردی یافت نشد.</p>
          ) : (
            <div role="status">
              <p>
                {orphans.length} مورد احتمالی؛ حداکثر ۱۰۰ مورد نمایش داده
                می‌شود.
              </p>
              <ul>
                {orphans.map((item) => (
                  <li key={item.path}>
                    <bdi>{item.path}</bdi> ·{" "}
                    {formatPersianDate(item.uploaded_at)}{" "}
                    <button
                      type="button"
                      className="minor"
                      disabled={busy}
                      onClick={() => void cleanOrphan(item.path, false)}
                    >
                      حذف این فایل
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {sharedOrphans &&
          (sharedOrphans.length === 0 ? (
            <p role="status">فایل مشترک احتمالی یافت نشد.</p>
          ) : (
            <div role="status">
              <p>
                {sharedOrphans.length} فایل مشترک احتمالی؛ حداکثر ۱۰۰ مورد نمایش
                داده می‌شود.
              </p>
              <ul>
                {sharedOrphans.map((item) => (
                  <li key={item.path}>
                    <bdi>{item.path}</bdi> ·{" "}
                    {formatPersianDate(item.uploaded_at)}{" "}
                    <button
                      type="button"
                      className="minor"
                      disabled={busy}
                      onClick={() => void cleanOrphan(item.path, true)}
                    >
                      حذف این فایل
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </details>
    </div>
  );
}
