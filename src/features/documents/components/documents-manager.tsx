"use client";

import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DOCUMENT_ENTITY_LABELS,
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_MIME_TYPES,
  type DocumentAttachment,
  type DocumentEntityType,
  type DocumentRecord,
  type DocumentVisibility,
} from "@/features/documents/types";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

type ListResponse = {
  documents?: DocumentRecord[];
  householdId?: string | null;
  message?: string;
};

type DetailResponse = {
  document?: DocumentRecord;
  attachments?: DocumentAttachment[];
  message?: string;
};

const MIME_ACCEPT = DOCUMENT_MIME_TYPES.join(",");

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | DocumentVisibility>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DocumentVisibility>("PRIVATE");
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [entityType, setEntityType] = useState<DocumentEntityType>("TASK");
  const [entityId, setEntityId] = useState("");

  const canShare = Boolean(householdId);

  async function loadDocuments() {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const data = (await response.json()) as ListResponse;
      if (response.status === 401) {
        throw new Error("برای مشاهده مدارک باید وارد حساب شوید.");
      }
      if (!response.ok) {
        throw new Error(data.message || "بارگذاری مدارک ناموفق بود.");
      }
      setDocuments(data.documents ?? []);
      setHouseholdId(data.householdId ?? null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "بارگذاری مدارک ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    const response = await fetch(`/api/documents/${id}`, { cache: "no-store" });
    const data = (await response.json()) as DetailResponse;
    if (!response.ok) {
      throw new Error(data.message || "دریافت مدرک ناموفق بود.");
    }
    setAttachments(data.attachments ?? []);
    setEditTitle(data.document?.title ?? "");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDocuments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(() => {
    if (filter === "ALL") return documents;
    return documents.filter((item) => item.visibility === filter);
  }, [documents, filter]);

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const body = new FormData();
      body.set("title", title);
      body.set("description", description);
      body.set("visibility", canShare ? visibility : "PRIVATE");
      body.set("file", file);
      const response = await fetch("/api/documents", {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "بارگذاری مدرک ناموفق بود.");
      }
      setShowForm(false);
      setTitle("");
      setDescription("");
      setFile(null);
      await loadDocuments();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "بارگذاری مدرک ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("این مدرک حذف شود؟")) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "حذف مدرک ناموفق بود.");
      }
      if (selectedId === id) {
        setSelectedId(null);
        setAttachments([]);
      }
      await loadDocuments();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "حذف مدرک ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(id: string) {
    setSelectedId(id);
    setErrorMessage(null);
    try {
      await loadDetail(id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "دریافت مدرک ناموفق بود.",
      );
    }
  }

  async function onSaveTitle(id: string) {
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "ویرایش مدرک ناموفق بود.");
      }
      await loadDocuments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ویرایش مدرک ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onView(id: string) {
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/documents/${id}/url`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.message || "ساخت لینک مشاهده ناموفق بود.");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "مشاهده فایل ناموفق بود.",
      );
    }
  }

  async function onAttach(id: string) {
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/documents/${id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "ثبت پیوست ناموفق بود.");
      }
      setEntityId("");
      await loadDetail(id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "ثبت پیوست ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDetach(documentId: string, attachmentId: string) {
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/documents/${documentId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message || "حذف پیوست ناموفق بود.");
      }
      await loadDetail(documentId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "حذف پیوست ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            مدارک
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            فایل‌های شخصی یا مشترک خانه. حداکثر ۱۰ مگابایت، PDF یا تصویر.
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus className="size-4" />
          {showForm ? "بستن فرم" : "مدرک جدید"}
        </Button>
      </section>

      {errorMessage ? (
        <ErrorState
          title="عملیات مدرک انجام نشد"
          description={errorMessage}
          onRetry={() => {
            setLoading(true);
            void loadDocuments();
          }}
        />
      ) : null}

      {showForm ? (
        <form className="space-y-3" onSubmit={(event) => void onUpload(event)}>
          <Card className="space-y-3">
            <CardTitle>بارگذاری مدرک</CardTitle>
            <Input
              label="عنوان"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <Input
              label="توضیحات"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">حریم خصوصی</label>
              <select
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={canShare ? visibility : "PRIVATE"}
                disabled={!canShare}
                onChange={(event) =>
                  setVisibility(event.target.value as DocumentVisibility)
                }
              >
                <option value="PRIVATE">خصوصی</option>
                <option value="HOUSEHOLD_SHARED" disabled={!canShare}>
                  اشتراکی خانه
                </option>
              </select>
            </div>
            <Input
              label="فایل"
              type="file"
              accept={MIME_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
            <Button type="submit" disabled={busy || !file}>
              {busy ? "در حال بارگذاری..." : "بارگذاری"}
            </Button>
          </Card>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["ALL", "PRIVATE", "HOUSEHOLD_SHARED"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === item
                ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
            )}
          >
            {item === "ALL"
              ? "همه"
              : item === "PRIVATE"
                ? "خصوصی"
                : "اشتراکی"}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری مدارک...
        </Card>
      ) : visible.length === 0 && !errorMessage ? (
        <EmptyState
          title="مدرکی ندارید"
          description="یک فایل PDF یا تصویر بارگذاری کنید."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>
                      <span className="inline-flex items-center gap-2">
                        <FileText className="size-4 shrink-0" />
                        {item.title}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {item.visibility === "PRIVATE" ? "خصوصی" : "اشتراکی"} ·{" "}
                      {formatSize(item.file_size)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onView(item.id)}
                  >
                    مشاهده
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onOpen(item.id)}
                  >
                    جزئیات
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void onDelete(item.id)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </Button>
                </div>
                {selectedId === item.id ? (
                  <div className="space-y-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
                    <Input
                      label="ویرایش عنوان"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                    />
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => void onSaveTitle(item.id)}
                      disabled={busy}
                    >
                      ذخیره عنوان
                    </Button>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <select
                        className="h-11 rounded-2xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        value={entityType}
                        onChange={(event) =>
                          setEntityType(
                            event.target.value as DocumentEntityType,
                          )
                        }
                      >
                        {DOCUMENT_ENTITY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {DOCUMENT_ENTITY_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <Input
                        label="شناسه مورد"
                        value={entityId}
                        onChange={(event) => setEntityId(event.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => void onAttach(item.id)}
                      disabled={busy || !entityId}
                    >
                      پیوست به مورد
                    </Button>
                    {attachments.length === 0 ? (
                      <p className="text-xs text-zinc-500">پیوستی ندارد.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {attachments.map((attachment) => (
                          <li
                            key={attachment.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>
                              {DOCUMENT_ENTITY_LABELS[attachment.entity_type]}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void onDetach(item.id, attachment.id)
                              }
                            >
                              حذف پیوست
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
