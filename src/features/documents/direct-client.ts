import type { SupabaseClient } from "@supabase/supabase-js";
import { createDocumentMetaSchema, updateDocumentSchema } from "./schemas";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_SELECT,
  DOCUMENT_SIGNED_URL_SECONDS,
  type DocumentRecord,
} from "./types";
import { z } from "zod";

export const documentCategory = z.enum([
  "IDENTITY",
  "FINANCE",
  "HOME",
  "TRAVEL",
  "OTHER",
]);
export type MobileDocument = DocumentRecord & {
  category: z.infer<typeof documentCategory>;
};
const COLUMNS = `${DOCUMENT_SELECT},category`;
async function currentUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب خود شوید.");
  return data.user.id;
}
export function directDocuments(client: SupabaseClient) {
  return {
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
    }: {
      file: File;
      title: string;
      description: string;
      visibility: "PRIVATE" | "HOUSEHOLD_SHARED";
      category: string;
    }) {
      const meta = createDocumentMetaSchema.parse({
        title,
        description: description || null,
        visibility,
        mimeType: file.type,
        fileSize: file.size,
      });
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
      const id = crypto.randomUUID();
      const safe =
        file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
      const path =
        visibility === "PRIVATE"
          ? `user/${user}/${id}/${safe}`
          : `household/${house}/${id}/${safe}`;
      const upload = await client.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, file, { contentType: meta.mimeType, upsert: false });
      if (upload.error) throw new Error("بارگذاری فایل ناموفق بود.");
      const { data, error } = await client
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
        })
        .select("id")
        .single();
      if (error || !data) {
        const removed = await client.storage
          .from(DOCUMENT_BUCKET)
          .remove([path]);
        throw new Error(
          removed.error
            ? "ثبت مدرک ناموفق بود و پاک‌سازی فایل نیاز به بررسی دارد."
            : "ثبت مدرک ناموفق بود؛ فایل بارگذاری‌شده پاک شد.",
        );
      }
    },
    async update(
      id: string,
      title: string,
      description: string,
      category: string,
    ) {
      const meta = updateDocumentSchema.parse({
        title,
        description: description || null,
      });
      const checked = documentCategory.parse(category);
      const { data, error } = await client
        .from("documents")
        .update({ ...meta, category: checked })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("ویرایش مدرک ناموفق بود.");
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
