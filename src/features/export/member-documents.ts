import type { SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { buildChecksums, digestBytes, readBackup } from "./backup-integrity";

type Row = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tables = [
  "profiles",
  "households",
  "household_members",
  "task_recurrence_instances",
  "finance_recurrence_instances",
  "tasks",
  "task_assignees",
  "task_recurrences",
  "events",
  "reminders",
  "notification_preferences",
  "chores",
  "chore_rotation_steps",
  "chore_completions",
  "shopping_lists",
  "shopping_items",
  "financial_records",
  "documents",
  "document_attachments",
] as const;

/** Produce a minimal file containing only one author's shared documents, never the owner's private data. */
export async function memberDocumentAuthors(
  bytes: Uint8Array,
): Promise<{ id: string; titles: string[] }[]> {
  const backup = await readBackup(bytes);
  const groups = new Map<string, string[]>();
  for (const value of backup.tables.documents) {
    const row = value as Row;
    if (
      row.visibility !== "HOUSEHOLD_SHARED" ||
      typeof row.created_by !== "string" ||
      !uuid.test(row.created_by)
    )
      continue;
    const titles = groups.get(row.created_by) ?? [];
    titles.push(typeof row.title === "string" ? row.title : "مدرک بدون عنوان");
    groups.set(row.created_by, titles);
  }
  return Array.from(groups, ([id, titles]) => ({ id, titles }));
}

export async function makeMemberDocumentBundle(
  bytes: Uint8Array,
  author: string,
  now: Date,
): Promise<Uint8Array> {
  if (!uuid.test(author)) throw new Error("شناسه عضو معتبر نیست.");
  const backup = await readBackup(bytes);
  if (backup.preview.integrity !== "verified")
    throw new Error("فایل باید دارای بررسی یکپارچگی باشد.");
  const docs = (backup.tables.documents as Row[])
    .filter(
      (r) => r.created_by === author && r.visibility === "HOUSEHOLD_SHARED",
    )
    .map((row) =>
      Object.fromEntries(
        [
          "id",
          "household_id",
          "created_by",
          "title",
          "description",
          "visibility",
          "category",
          "mime_type",
          "file_size",
          "archive_file",
          "created_at",
          "updated_at",
        ].map((key) => [key, row[key]]),
      ),
    );
  if (!docs.length) throw new Error("مدرکی برای این عضو در فایل وجود ندارد.");
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const row of docs)
    files[row.archive_file as string] =
      backup.files[row.archive_file as string];
  files["archive.json"] = strToU8(
    JSON.stringify({
      exported_at: now.toISOString(),
      note: "فقط مدارک مشترک یک عضو؛ محتوا توسط عضو بررسی و تأیید شود.",
      tables: { documents: docs },
      counts: { documents: docs.length },
    }),
  );
  files["checksums.json"] = await buildChecksums(files);
  return zipSync(files, { level: 0 });
}

async function currentUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("ابتدا با حساب سازندهٔ مدارک وارد شوید.");
  return data.user.id;
}

/** An author explicitly re-uploads their own content. Never impersonates another member. */
export async function restoreOwnSharedDocuments(
  client: SupabaseClient,
  bytes: Uint8Array,
): Promise<{ inserted: number; skipped: number; repaired: number }> {
  const user = await currentUser(client);
  const backup = await readBackup(bytes);
  if (backup.preview.integrity !== "verified")
    throw new Error("فایل باید دارای بررسی یکپارچگی باشد.");
  // Only accept minimal bundles. The owner must not hand over a full archive
  // containing their private information to another household member.
  if (
    Object.keys(backup.tables).length !== 1 ||
    !backup.tables.documents.length
  )
    throw new Error(
      "برای این کار از مالک خانه فایل جداگانهٔ مدارک خودتان را بخواهید.",
    );
  const rows = backup.tables.documents as Row[];
  if (
    rows.some(
      (r) =>
        r.created_by !== user ||
        r.visibility !== "HOUSEHOLD_SHARED" ||
        !Number.isSafeInteger(r.file_size) ||
        (r.file_size as number) < 1 ||
        (r.file_size as number) > 10485760,
    )
  )
    throw new Error(
      "این بسته فقط باید شامل مدارک مشترک ساخته‌شده با حساب شما باشد.",
    );
  const snapshot = await client.rpc("mobile_export_snapshot");
  if (
    snapshot.error ||
    !snapshot.data?.tables ||
    !Array.isArray(snapshot.data.tables.household_members) ||
    !Array.isArray(snapshot.data.tables.documents)
  )
    throw new Error("بررسی خانه و مدارک فعلی ناموفق بود.");
  const members = snapshot.data.tables.household_members as Row[];
  const member = members.find((m) => m.user_id === user && m.left_at === null);
  if (
    !member ||
    typeof member.household_id !== "string" ||
    !uuid.test(member.household_id)
  )
    throw new Error("ابتدا دوباره به خانه بپیوندید.");
  const home = member.household_id;
  const existing = new Map<string, Row>(
    (snapshot.data.tables.documents as Row[]).map((row) => [
      row.id as string,
      row,
    ]),
  );
  const restoreTables: Record<string, Row[]> = Object.fromEntries(
    tables.map((name) => [name, []]),
  );
  let repaired = 0;
  for (const row of rows) {
    if ((await currentUser(client)) !== user)
      throw new Error("حساب تغییر کرد؛ عملیات متوقف شد.");
    const doc = existing.get(row.id as string);
    if (
      doc &&
      (doc.created_by !== user ||
        doc.household_id !== home ||
        doc.visibility !== "HOUSEHOLD_SHARED" ||
        doc.mime_type !== row.mime_type ||
        doc.file_size !== row.file_size ||
        typeof doc.storage_path !== "string")
    )
      throw new Error("مدرک موجود با فایل سازگار نیست؛ چیزی جایگزین نشد.");
    const suffix = (row.archive_file as string).split(".").at(-1);
    const path = doc
      ? (doc.storage_path as string)
      : `household/${home}/${row.id}/restore.${suffix}`;
    if (!path.startsWith(`household/${home}/${row.id}/`))
      throw new Error("مسیر مدرک فعلی معتبر نیست.");
    const bucket = client.storage.from("documents");
    const downloaded = doc ? await bucket.download(path) : null;
    if (!downloaded?.data || downloaded.error) {
      const content = backup.files[row.archive_file as string];
      const uploaded = await bucket.upload(
        path,
        new Blob([new Uint8Array(content)], { type: row.mime_type as string }),
        { upsert: false, contentType: row.mime_type as string },
      );
      if (uploaded.error) {
        const found = await bucket.download(path);
        if (
          found.error ||
          !found.data ||
          found.data.size !== content.length ||
          (await digestBytes(
            new Uint8Array(await found.data.arrayBuffer()),
          )) !== (await digestBytes(content))
        )
          throw new Error(
            "ثبت فایل تأیید نشد؛ فایل موجود جایگزین نشد و ممکن است فایل موقت باقی مانده باشد.",
          );
      }
      if (doc) repaired++;
    }
    restoreTables.documents.push({
      ...row,
      household_id: home,
      storage_path: path,
    });
  }
  if ((await currentUser(client)) !== user)
    throw new Error("حساب تغییر کرد؛ ممکن است فایل موقت باقی مانده باشد.");
  const result = await client.rpc("mobile_restore_missing", {
    p_tables: restoreTables,
  });
  if (
    result.error ||
    !Number.isSafeInteger(result.data?.inserted) ||
    !Number.isSafeInteger(result.data?.skipped)
  )
    throw new Error(
      "ثبت مدارک تأیید نشد؛ ممکن است فایل موقت باقی مانده باشد. پیش از تلاش دوباره وضعیت مدارک را بررسی کنید.",
    );
  return {
    inserted: result.data.inserted,
    skipped: result.data.skipped,
    repaired,
  };
}
