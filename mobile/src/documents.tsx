import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FileText,
  LockKeyhole,
  UsersRound,
  Plus,
  FolderOpen,
} from "lucide-react";
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
}: {
  client: SupabaseClient;
  householdId: string | null;
}) {
  const api = useMemo(() => directDocuments(client), [client]);
  const [items, setItems] = useState<MobileDocument[]>([]);
  const [category, setCategory] = useState<Category>("ALL");
  const [form, setForm] = useState(false);
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف مدرک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter(
    (x) => category === "ALL" || x.category === category,
  );
  return (
    <div className="documents-page">
      <div className="documents-heading">
        <div>
          <span className="overline">دفتر خانهٔ ما</span>
          <h2>
            مدارک ما <span aria-hidden="true">♡</span>
          </h2>
          <p>همه چیزهایی که با هم می‌سازیم</p>
        </div>
        <button
          className="document-add"
          disabled={!loaded}
          onClick={() => {
            reset();
            setForm(true);
          }}
          aria-label="افزودن مدرک"
        >
          <Plus size={28} />
          <small>افزودن مدرک</small>
        </button>
      </div>
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
        <section className="document-form">
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
        <section>
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
      <div className="document-tabs" role="tablist" aria-label="دسته مدارک">
        {Object.entries(cats).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            onClick={() => setCategory(key as Category)}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.map((row) => (
        <article className="document-card" key={row.id}>
          <div className="document-copy">
            <strong>{row.title}</strong>
            <span className="document-category">
              ● {cats[row.category] ?? "سایر"}
            </span>
            <small>
              {formatPersianDate(row.created_at)} ·{" "}
              {(row.file_size / 1048576).toLocaleString("fa-IR", {
                maximumFractionDigits: 2,
              })}{" "}
              مگابایت
            </small>
            {row.description && <small>{row.description}</small>}
            <div className="document-actions">
              <button
                className="minor"
                disabled={busy}
                onClick={() => void open(row)}
              >
                باز کردن
              </button>
              <button
                className="minor"
                disabled={busy}
                onClick={() => edit(row)}
              >
                ویرایش
              </button>
              <button
                className="minor"
                disabled={busy}
                onClick={() => void manageLinks(row)}
              >
                پیوندها
              </button>
              <button
                className="minor"
                disabled={busy}
                onClick={() => void remove(row)}
              >
                حذف
              </button>
            </div>
          </div>
          <div className="document-icon">
            <FileText size={30} strokeWidth={1.35} />
            <span>
              {row.visibility === "PRIVATE" ? (
                <>
                  <LockKeyhole size={15} /> خصوصی
                </>
              ) : (
                <>
                  <UsersRound size={15} /> مشترک
                </>
              )}
            </span>
          </div>
        </article>
      ))}
      {loaded && !visible.length && (
        <div className="paper-note">
          <FolderOpen size={24} />
          <p>
            هنوز در این بخش مدرکی اضافه نکرده‌اید.
            <br />
            برای افزودن اولین مدرک، دکمهٔ بالا را بزنید.
          </p>
        </div>
      )}
    </div>
  );
}
