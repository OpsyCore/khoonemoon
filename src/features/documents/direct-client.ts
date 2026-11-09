import { pendingRequest } from "@/lib/mutations/pending-create";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDocumentMetaSchema,
  documentCategorySchema,
  documentExpiryMetaSchema,
  updateDocumentSchema,
  createDocumentAttachmentSchema,
} from "./schemas";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_SELECT,
  DOCUMENT_SIGNED_URL_SECONDS,
  type DocumentCategory,
  type DocumentRecord,
  DOCUMENT_ATTACHMENT_SELECT,
  type DocumentAttachment,
  type DocumentEntityType,
  type DocumentRenewalRecord,
} from "./types";
import { z } from "zod";

export const documentCategory = documentCategorySchema;
export type MobileDocument = DocumentRecord & {
  category: DocumentCategory;
};
const COLUMNS = `${DOCUMENT_SELECT},category`;

export type DocumentExtraInput = {
  issuedAt?: string | null;
  expiresAt?: string | null;
  issuer?: string | null;
  referenceCode?: string | null;
  renewalRequired?: boolean;
};

async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}

export function directDocuments(client: SupabaseClient) {
  return {
    async possibleOrphans(): Promise<{ path: string; uploaded_at: string }[]> {
      const { data, error } = await client.rpc("possible_orphan_documents");
      if (error || !Array.isArray(data))
        throw new Error("بررسی فایل‌های احتمالی ناموفق بود.");
      return data as { path: string; uploaded_at: string }[];
    },
    async possibleSharedOrphans(
      householdId: string,
    ): Promise<{ path: string; uploaded_at: string }[]> {
      const { data, error } = await client.rpc(
        "possible_shared_orphan_documents",
        { p_household: householdId },
      );
      if (error || !Array.isArray(data))
        throw new Error(
          "بررسی فایل‌های مشترک فقط برای مالک فعلی خانه ممکن است.",
        );
      return data as { path: string; uploaded_at: string }[];
    },
    async cleanPossibleOrphan(path: string): Promise<void> {
      const marked = await client.rpc("mark_document_orphan_for_cleanup", {
        p_path: path,
      });
      if (marked.error || marked.data !== true)
        throw new Error(
          "آماده‌سازی حذف تأیید نشد؛ چیزی حذف نشد، اما ممکن است مسیر بازنشسته شده باشد. دوباره بررسی کنید.",
        );
      let removed;
      try {
        removed = await client.storage.from(DOCUMENT_BUCKET).remove([path]);
      } catch {
        throw new Error(
          "نتیجهٔ حذف فایل مشخص نیست؛ مسیر بازنشسته شده است. وضعیت فایل را دوباره بررسی کنید.",
        );
      }
      if (removed.error)
        throw new Error(
          "نتیجهٔ حذف فایل مشخص نیست؛ مسیر بازنشسته شده است. وضعیت فایل را دوباره بررسی کنید.",
        );
      const confirmed = await client.rpc("document_cleanup_confirm", {
        p_path: path,
      });
      if (confirmed.error || confirmed.data !== true)
        throw new Error("نتیجهٔ حذف تأیید نشد؛ بررسی را دوباره اجرا کنید.");
    },
    async list(): Promise<MobileDocument[]> {
      const rows: MobileDocument[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client
          .from("documents")
          .select(COLUMNS)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error)
          throw new Error(
            "دریافت مدارک ناموفق بود؛ اتصال و آماده‌بودن بخش مدارک را بررسی کنید.",
          );
        rows.push(...((data ?? []) as unknown as MobileDocument[]));
        if (!data || data.length < 500) return rows;
        if (rows.length >= 10000)
          throw new Error("تعداد مدارک بیش از حد مجاز است.");
      }
    },
    async create({
      file,
      title,
      description,
      visibility,
      category,
      extra,
      onCreated,
    }: {
      file: File;
      title: string;
      description: string;
      visibility: "PRIVATE" | "HOUSEHOLD_SHARED";
      category: string;
      extra?: DocumentExtraInput;
      onCreated?: (id: string) => void;
    }): Promise<void> {
      const meta = createDocumentMetaSchema.parse({
        title,
        description: description || null,
        visibility,
        mimeType: file.type,
        fileSize: file.size,
      });
      const expiryMeta = extra
        ? documentExpiryMetaSchema.parse({
            issuedAt: extra.issuedAt || null,
            expiresAt: extra.expiresAt || null,
            issuer: extra.issuer || null,
            referenceCode: extra.referenceCode || null,
            renewalRequired: extra.renewalRequired,
          })
        : null;
      const categoryValue = documentCategory.parse(category);
      const user = await currentUser(client);
      let house: string | null = null;
      if (visibility === "HOUSEHOLD_SHARED") {
        const { data, error } = await client
          .from("household_members")
          .select("household_id")
          .eq("user_id", user)
          .is("left_at", null)
          .maybeSingle();
        if (error || !data?.household_id)
          throw new Error("برای مدرک مشترک باید عضو خانه باشید.");
        house = data.household_id;
      }
      const fileHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const safe =
        file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
      let createdId = "";
      await pendingRequest<true>({
        user,
        kind: "document",
        input: {
          meta,
          categoryValue,
          visibility,
          house,
          safe,
          fileHash,
          ...(expiryMeta ? { expiryMeta } : {}),
        },
        submit: async (id) => {
          createdId = id;
          const path =
            visibility === "PRIVATE"
              ? `user/${user}/${id}/${safe}`
              : `household/${house}/${id}/${safe}`;
          const lookup = async () => {
            const result = await client
              .from("documents")
              .select("id,storage_path,created_by")
              .eq("id", id)
              .maybeSingle();
            return (
              !result.error &&
              result.data?.id === id &&
              result.data?.storage_path === path &&
              result.data?.created_by === user
            );
          };
          if (await lookup()) return { data: true, error: null };
          const upload = await client.storage
            .from(DOCUMENT_BUCKET)
            .upload(path, file, { contentType: meta.mimeType, upsert: false });
          if (upload.error) {
            const existing = await client.storage
              .from(DOCUMENT_BUCKET)
              .download(path);
            if (existing.error || !existing.data)
              return { data: null, error: existing.error ?? "unknown" };
            const hash = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  await existing.data.arrayBuffer(),
                ),
              ),
              (byte) => byte.toString(16).padStart(2, "0"),
            ).join("");
            if (hash !== fileHash)
              return { data: null, error: "mismatched object" };
          }
          const result = await client
            .from("documents")
            .insert({
              id,
              household_id: house,
              created_by: user,
              title: meta.title,
              description: meta.description ?? null,
              mime_type: meta.mimeType,
              file_size: meta.fileSize,
              storage_path: path,
              visibility,
              category: categoryValue,
              ...(expiryMeta
                ? {
                    issued_at: expiryMeta.issuedAt ?? null,
                    expires_at: expiryMeta.expiresAt ?? null,
                    issuer: expiryMeta.issuer ?? null,
                    reference_code: expiryMeta.referenceCode ?? null,
                    renewal_required: expiryMeta.renewalRequired ?? false,
                  }
                : {}),
            })
            .select("id")
            .single();
          if (!result.error && result.data?.id === id)
            return { data: true, error: null };
          if (await lookup()) return { data: true, error: null };
          return { data: null, error: result.error ?? "unknown" };
        },
        valid: (value): value is true => value === true,
      });
      if (createdId && onCreated) onCreated(createdId);
    },
    async update(
      id: string,
      title: string,
      description: string,
      category: string,
      extra?: DocumentExtraInput,
    ) {
      const meta = updateDocumentSchema.parse({
        title,
        description: description || null,
      });
      const checked = documentCategory.parse(category);
      const expiryMeta = extra
        ? documentExpiryMetaSchema.parse({
            issuedAt: extra.issuedAt || null,
            expiresAt: extra.expiresAt || null,
            issuer: extra.issuer || null,
            referenceCode: extra.referenceCode || null,
            renewalRequired: extra.renewalRequired,
          })
        : null;
      const { data, error } = await client
        .from("documents")
        .update({
          ...meta,
          category: checked,
          ...(expiryMeta
            ? {
                issued_at: expiryMeta.issuedAt ?? null,
                expires_at: expiryMeta.expiresAt ?? null,
                issuer: expiryMeta.issuer ?? null,
                reference_code: expiryMeta.referenceCode ?? null,
                renewal_required: expiryMeta.renewalRequired ?? false,
              }
            : {}),
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("ویرایش مدرک ناموفق بود.");
    },
    async renew(input: {
      documentId: string;
      newExpiresAt: string;
      note?: string;
      replacementDocumentId?: string | null;
    }): Promise<string> {
      const user = await currentUser(client);
      const parsed = z
        .object({
          documentId: z.string().uuid(),
          newExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().trim().max(500).optional(),
          replacementDocumentId: z.string().uuid().nullable().optional(),
        })
        .parse(input);
      return pendingRequest<string>({
        user,
        kind: "document-renew",
        input: parsed,
        submit: (reqId) =>
          client.rpc("renew_document", {
            p_document_id: parsed.documentId,
            p_new_expires_at: parsed.newExpiresAt,
            p_note: parsed.note || null,
            p_replacement_document_id: parsed.replacementDocumentId || null,
            p_request_id: reqId,
          }),
        valid: (val): val is string =>
          typeof val === "string" && /^[0-9a-f-]{36}$/i.test(val),
      });
    },
    async renewals(documentId: string): Promise<DocumentRenewalRecord[]> {
      const { data, error } = await client
        .from("document_renewals")
        .select(
          "id,document_id,renewed_by,previous_expires_at,new_expires_at,renewed_at,note,replacement_document_id,request_id,created_at",
        )
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw new Error("دریافت سابقه تمدید ناموفق بود.");
      return (data ?? []) as DocumentRenewalRecord[];
    },
    async remove(record: MobileDocument) {
      const { data, error } = await client
        .from("documents")
        .delete()
        .eq("id", record.id)
        .select("id")
        .maybeSingle();
      if (error || !data)
        throw new Error(
          "وضعیت حذف مدرک نامشخص است؛ فهرست را تازه‌سازی کنید. فایل نگه داشته شد.",
        );
      const deleted = await client.storage
        .from(DOCUMENT_BUCKET)
        .remove([record.storage_path]);
      if (deleted.error)
        throw new Error(
          "اطلاعات مدرک حذف شد اما حذف فایل تأیید نشد؛ فایل ممکن است در فضای ذخیره‌سازی باقی مانده باشد.",
        );
    },
    async attachments(id: string): Promise<DocumentAttachment[]> {
      const { data, error } = await client
        .from("document_attachments")
        .select(DOCUMENT_ATTACHMENT_SELECT)
        .eq("document_id", id)
        .order("created_at", { ascending: false });
      if (error) throw new Error("دریافت پیوندهای مدرک ناموفق بود.");
      return (data ?? []) as DocumentAttachment[];
    },
    async targets(
      type: DocumentEntityType,
    ): Promise<{ id: string; title: string }[]> {
      const tables = {
        TASK: "tasks",
        EVENT: "events",
        CHORE: "chores",
        SHOPPING_LIST: "shopping_lists",
        FINANCE_RECORD: "financial_records",
        APPLIANCE: "home_appliances",
      } as const;
      const field =
        type === "SHOPPING_LIST" || type === "APPLIANCE" ? "name" : "title";
      let query = client.from(tables[type]).select(`id,${field}`).limit(1000);
      if (type === "APPLIANCE") query = query.is("archived_at", null);
      const { data, error } = await query;
      if (error) throw new Error("دریافت موارد قابل پیوند ناموفق بود.");
      return ((data ?? []) as unknown as Record<string, string>[]).map(
        (row) => ({ id: row.id, title: row[field] }),
      );
    },
    async attach(id: string, type: DocumentEntityType, entityId: string) {
      const item = createDocumentAttachmentSchema.parse({
        entityType: type,
        entityId,
      });
      const user = await currentUser(client);
      try {
        const { error } = await client.from("document_attachments").insert({
          document_id: id,
          entity_type: item.entityType,
          entity_id: item.entityId,
          created_by: user,
        });
        if (!error) return;
      } catch {
        /* The link may have committed. */
      }
      const check = await client
        .from("document_attachments")
        .select("id")
        .eq("document_id", id)
        .eq("entity_type", item.entityType)
        .eq("entity_id", item.entityId)
        .maybeSingle();
      if (!check.error && check.data) return;
      throw new Error(
        "نتیجهٔ ثبت پیوند مشخص نیست؛ فهرست پیوندها را تازه کنید و دوباره بررسی کنید.",
      );
    },
    async detach(id: string) {
      const { data, error } = await client
        .from("document_attachments")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("حذف پیوند ناموفق بود.");
    },
    async signedUrl(record: MobileDocument) {
      const { data, error } = await client.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(record.storage_path, DOCUMENT_SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl)
        throw new Error("باز کردن فایل ناموفق بود.");
      return data.signedUrl;
    },
  };
}
