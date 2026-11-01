import type { SupabaseClient } from "@supabase/supabase-js";
import { digestBytes, readBackup } from "./backup-integrity";

const TABLES = [
  "profiles",
  "households",
  "household_members",
  "shopping_lists",
  "tasks",
  "events",
  "chores",
  "financial_records",
  "reminders",
  "notification_preferences",
  "task_assignees",
  "task_recurrences",
  "chore_rotation_steps",
  "shopping_items",
  "documents",
  "document_attachments",
  "task_recurrence_instances",
  "finance_recurrence_instances",
  "chore_completions",
] as const;
const READ_ONLY: Record<string, string> = {
  profiles: "id",
  households: "id",
  household_members: "id",
  task_recurrence_instances: "completed_task_id",
  finance_recurrence_instances: "paid_record_id",
  chore_completions: "id",
};
const KEY: Record<string, string> = {
  task_recurrence_instances: "completed_task_id",
  finance_recurrence_instances: "paid_record_id",
};
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;
async function currentUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("ابتدا وارد حساب اصلی خروجی شوید.");
  return data.user.id;
}
/** Explicit opt-in operation: existing records are never modified, including on retries.
 * DB writes are atomic, Storage uploads are separate and may leave orphaned objects. */
export async function restoreMissing(
  client: SupabaseClient,
  bytes: Uint8Array,
): Promise<{ inserted: number; skipped: number; repairedFiles: number }> {
  const user = await currentUser(client);
  const backup = await readBackup(bytes);
  if (backup.preview.integrity !== "verified")
    throw new Error(
      "فقط خروجی جدید دارای مجموع کنترلی قابل بازیابی است؛ فایل قدیمی را صرفاً می‌توانید بررسی کنید.",
    );
  if (backup.preview.rowCount > 50000)
    throw new Error(
      "بازیابی یک‌مرحله‌ای حداکثر ۵۰٬۰۰۰ ردیف را می‌پذیرد؛ داده‌ای تغییر نکرد.",
    );
  const names = Object.keys(backup.tables);
  if (
    names.length !== TABLES.length ||
    TABLES.some((name) => !Object.hasOwn(backup.tables, name))
  )
    throw new Error("این نسخه همه بخش‌های لازم برای بازیابی را ندارد.");
  const tables: Record<string, Row[]> = Object.create(null);
  for (const name of TABLES) {
    const rows = backup.tables[name];
    if (
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    )
      throw new Error("ردیف خروجی معتبر نیست.");
    tables[name] = rows.map((row) => ({ ...(row as Row) }));
    const key = KEY[name] ?? "id";
    if (
      tables[name].some(
        (row) =>
          typeof row[key] !== "string" || !idPattern.test(row[key] as string),
      )
    )
      throw new Error("شناسهٔ یکی از ردیف‌ها معتبر نیست.");
  }
  if (tables.profiles.length !== 1 || tables.profiles[0].id !== user)
    throw new Error(
      "این خروجی متعلق به حساب واردشده نیست؛ داده‌ای تغییر نکرد.",
    );
  const signed = backup.signedSnapshot;
  if (signed) {
    const verified = await client.rpc("mobile_verify_snapshot_signature", {
      p_payload: signed.payload,
      p_signature: signed.signature,
    });
    if (verified.error || verified.data !== true)
      throw new Error(
        "اصالت اطلاعات این پشتیبان با حساب و سرور فعلی تأیید نشد؛ داده‌ای تغییر نکرد.",
      );
  }
  const current = await client.rpc("mobile_export_snapshot");
  if (current.error || !current.data?.tables)
    throw new Error("بررسی اطلاعات فعلی ناموفق بود؛ داده‌ای تغییر نکرد.");
  for (const [table, key] of Object.entries(READ_ONLY)) {
    if (
      signed &&
      (table === "task_recurrence_instances" ||
        table === "finance_recurrence_instances" ||
        table === "chore_completions")
    )
      continue;
    const existing = current.data.tables[table];
    if (!Array.isArray(existing))
      throw new Error("بررسی اطلاعات فعلی ناموفق بود؛ داده‌ای تغییر نکرد.");
    const ids = new Set(existing.map((row: Row) => row[key]));
    if (tables[table].some((row) => !ids.has(row[key])))
      throw new Error(
        "خانه، عضویت یا تاریخچهٔ لازم دیگر موجود نیست؛ بازیابی ایمن ممکن نیست و داده‌ای تغییر نکرد.",
      );
  }
  // Detect known RLS failures before staging any Storage objects. The server
  // still independently enforces RLS; this is only an early diagnostic.
  const requiredOwners: Record<string, string[]> = {
    tasks: ["creator_id", "owner_id"],
    events: ["creator_id", "owner_id"],
    chores: ["created_by"],
    shopping_lists: ["created_by"],
    shopping_items: ["added_by"],
    financial_records: ["created_by"],
    reminders: ["user_id"],
    notification_preferences: ["user_id"],
    documents: ["created_by"],
    document_attachments: ["created_by"],
  };
  for (const [name, ownerFields] of Object.entries(requiredOwners)) {
    const existing = current.data.tables[name];
    if (!Array.isArray(existing))
      throw new Error("بررسی اطلاعات فعلی ناموفق بود؛ داده‌ای تغییر نکرد.");
    const ids = new Set(existing.map((row: Row) => row.id));
    if (
      tables[name].some(
        (row) =>
          !ids.has(row.id) && ownerFields.some((field) => row[field] !== user),
      )
    )
      throw new Error(
        "برخی ردیف‌های حذف‌شده متعلق به عضو دیگری هستند و با این حساب قابل بازیابی نیستند؛ داده‌ای تغییر نکرد.",
      );
  }
  const existingDocs = current.data.tables.documents;
  if (!Array.isArray(existingDocs))
    throw new Error("بررسی مدارک فعلی ناموفق بود.");
  const docMap = new Map<string, Row>(
    existingDocs.map((row: Row) => [row.id as string, row]),
  );
  const uploads: {
    row: Row;
    path: string;
    content: Uint8Array;
    repair: boolean;
  }[] = [];
  for (const row of tables.documents) {
    const existing = docMap.get(row.id as string);
    if (existing) {
      row.storage_path = existing.storage_path;
      if (typeof existing.storage_path !== "string")
        throw new Error("مسیر مدرک فعلی معتبر نیست.");
      if ((await currentUser(client)) !== user)
        throw new Error("حساب در حین بازیابی تغییر کرد؛ عملیات متوقف شد.");
      const downloaded = await client.storage
        .from("documents")
        .download(existing.storage_path);
      // Never replace an existing file, even if it differs from the archive.
      if (!downloaded.error && downloaded.data) continue;
      // Only repair an absent file if the metadata still identifies the exact
      // same original document, and the caller was its author. A failed read
      // is not evidence of absence: the subsequent upload is always no-upsert.
      if (
        [
          "id",
          "created_by",
          "visibility",
          "household_id",
          "mime_type",
          "file_size",
        ].some((key) => row[key] !== existing[key]) ||
        row.created_by !== user
      )
        throw new Error(
          "فایل یک مدرک فعلی قابل خواندن نیست یا اطلاعاتش تغییر کرده؛ برای جلوگیری از جایگزینی، بازیابی متوقف شد.",
        );
    }
    if (
      row.created_by !== user ||
      typeof row.archive_file !== "string" ||
      typeof row.mime_type !== "string"
    )
      throw new Error("مدرک متعلق به حساب دیگر است و بازیابی خودکار امن نیست.");
    const ext = row.archive_file.split(".").at(-1);
    let prefix: string;
    if (row.visibility === "PRIVATE" && row.household_id === null)
      prefix = `user/${user}`;
    else if (
      row.visibility === "HOUSEHOLD_SHARED" &&
      typeof row.household_id === "string" &&
      idPattern.test(row.household_id)
    )
      prefix = `household/${row.household_id}`;
    else throw new Error("دسترسی یا خانهٔ مدرک معتبر نیست.");
    const path = existing
      ? (existing.storage_path as string)
      : `${prefix}/${row.id}/restore.${ext}`;
    if (!path.startsWith(`${prefix}/${row.id}/`))
      throw new Error("مسیر مدرک فعلی با مالکیت آن سازگار نیست.");
    const content = backup.files[row.archive_file];
    if (!content) throw new Error("فایل مدرک در خروجی موجود نیست.");
    row.storage_path = path;
    uploads.push({ row, path, content, repair: !!existing });
  }
  for (const item of uploads) {
    if ((await currentUser(client)) !== user)
      throw new Error("حساب در حین بازیابی تغییر کرد؛ عملیات متوقف شد.");
    const bucket = client.storage.from("documents");
    const { error } = await bucket.upload(
      item.path,
      new Blob([new Uint8Array(item.content)], {
        type: item.row.mime_type as string,
      }),
      { upsert: false, contentType: item.row.mime_type as string },
    );
    if (error) {
      // A previous attempt or a lost response may have created the object. Reuse
      // it only after confirming exact bytes. Never overwrite or delete an object.
      const existing = await bucket.download(item.path);
      if (
        existing.error ||
        !existing.data ||
        existing.data.size !== item.content.length ||
        (await digestBytes(
          new Uint8Array(await existing.data.arrayBuffer()),
        )) !== (await digestBytes(item.content))
      )
        throw new Error(
          "ثبت یکی از فایل‌ها تأیید نشد؛ فایل موجود تغییر نکرد. ممکن است بعضی فایل‌ها بارگذاری شده یا فایل موقت باقی مانده باشد.",
        );
    }
  }
  if ((await currentUser(client)) !== user)
    throw new Error(
      "حساب در حین بازیابی تغییر کرد؛ داده‌ها ثبت نشدند و ممکن است بعضی فایل‌ها بارگذاری شده یا فایل موقت باقی مانده باشد.",
    );
  const restoreTables = signed
    ? {
        ...tables,
        task_recurrence_instances: [],
        finance_recurrence_instances: [],
        chore_completions: [],
      }
    : tables;
  const { data, error } = await client.rpc("mobile_restore_missing", {
    p_tables: restoreTables,
  });
  if (
    error ||
    !data ||
    !Number.isSafeInteger(data.inserted) ||
    !Number.isSafeInteger(data.skipped)
  )
    throw new Error(
      "نتیجهٔ بازیابی تأیید نشد؛ فهرست‌ها را تازه کنید و پیش از تلاش دوباره بررسی کنید. ممکن است بعضی فایل‌ها بارگذاری شده یا فایل موقت باقی مانده باشد.",
    );
  let historyInserted = 0,
    historySkipped = 0;
  if (signed) {
    if ((await currentUser(client)) !== user)
      throw new Error(
        "حساب در حین بازیابی تغییر کرد؛ بخشی از داده‌ها ممکن است ثبت شده باشند.",
      );
    const history = await client.rpc("mobile_restore_signed_history", {
      p_payload: signed.payload,
      p_signature: signed.signature,
    });
    if (
      history.error ||
      !history.data ||
      !Number.isSafeInteger(history.data.inserted) ||
      !Number.isSafeInteger(history.data.skipped)
    )
      throw new Error(
        "داده‌های اصلی ممکن است ثبت شده باشند، اما بازیابی تاریخچه تأیید نشد. فهرست‌ها را بررسی کنید؛ تلاش دوباره ردیف‌های موجود را بازنویسی نمی‌کند.",
      );
    historyInserted = history.data.inserted;
    historySkipped = history.data.skipped;
  }
  return {
    inserted: data.inserted + historyInserted,
    skipped: data.skipped + historySkipped,
    repairedFiles: uploads.filter((item) => item.repair).length,
  };
}
