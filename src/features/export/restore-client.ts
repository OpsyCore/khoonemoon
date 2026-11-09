import type { SupabaseClient } from "@supabase/supabase-js";
import { availableRestorePath } from "@/features/documents/restore-path";
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
  allowHouseholdCopy = false,
): Promise<{
  inserted: number;
  skipped: number;
  repairedFiles: number;
  householdCopy: boolean;
  deferred: number;
}> {
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
  const hasMeals = Object.hasOwn(backup.tables, "meal_plans");
  const v3Tables = [
    "document_renewals",
    "home_appliances",
    "appliance_maintenance_logs",
  ] as const;
  const hasHomeV3 = v3Tables.some((n) => Object.hasOwn(backup.tables, n));
  if (
    (hasHomeV3 && !v3Tables.every((n) => Object.hasOwn(backup.tables, n))) ||
    names.length !==
      TABLES.length + (hasMeals ? 1 : 0) + (hasHomeV3 ? v3Tables.length : 0) ||
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
  if ((hasMeals || hasHomeV3) && !signed)
    throw new Error("بازیابی برنامه غذایی فقط با پشتیبان امضاشده ممکن است.");
  if (hasHomeV3) {
    for (const v3Name of v3Tables) {
      if (
        backup.tables[v3Name].some(
          (row) =>
            !row ||
            typeof row !== "object" ||
            Array.isArray(row) ||
            typeof (row as Row).id !== "string" ||
            !idPattern.test((row as Row).id as string),
        )
      )
        throw new Error("ردیف نسخهٔ سوم پشتیبان معتبر نیست.");
    }
  }
  if (
    hasMeals &&
    backup.tables.meal_plans.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        typeof (row as Row).id !== "string" ||
        !idPattern.test((row as Row).id as string),
    )
  )
    throw new Error("ردیف برنامه غذایی معتبر نیست.");
  const originalMembers = tables.household_members.map((row) => ({ ...row }));
  const sourceHouse =
    tables.households.length === 1 ? (tables.households[0].id as string) : null;
  const signedOwner =
    !!sourceHouse &&
    tables.household_members.some(
      (row) =>
        row.household_id === sourceHouse &&
        row.user_id === user &&
        row.role === "OWNER" &&
        row.left_at === null,
    );
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
  let current = await client.rpc("mobile_export_snapshot");
  if (current.error || !current.data?.tables)
    throw new Error("بررسی اطلاعات فعلی ناموفق بود؛ داده‌ای تغییر نکرد.");
  let householdCopy = false;
  const currentHomes = current.data.tables.households;
  if (!Array.isArray(currentHomes))
    throw new Error("بررسی خانهٔ فعلی ناموفق بود.");
  const missingHomes = tables.households.filter(
    (row) => !currentHomes.some((home: Row) => home.id === row.id),
  );
  if (missingHomes.length) {
    if (!signed)
      throw new Error(
        "خانهٔ اصلی موجود نیست و این پشتیبان قدیمی امضای لازم برای ساخت خانهٔ جدید را ندارد.",
      );
    if (
      !allowHouseholdCopy ||
      missingHomes.length !== 1 ||
      tables.households.length !== 1
    )
      throw new Error(
        "خانهٔ اصلی موجود نیست؛ برای ساخت نسخهٔ جداگانه باید گزینهٔ مربوط را تأیید کنید.",
      );
    const source = missingHomes[0].id as string;
    if (
      !tables.household_members.some(
        (row) =>
          row.household_id === source &&
          row.user_id === user &&
          row.role === "OWNER" &&
          row.left_at === null,
      )
    )
      throw new Error("ساخت نسخهٔ خانه فقط برای مالک پشتیبان ممکن است.");
    if ((await currentUser(client)) !== user)
      throw new Error("حساب تغییر کرد؛ خانه‌ای ساخته نشد.");
    const copied = await client.rpc("mobile_recover_household_copy", {
      p_payload: signed.payload,
      p_signature: signed.signature,
      p_source: source,
    });
    if (
      copied.error ||
      typeof copied.data !== "string" ||
      !idPattern.test(copied.data)
    )
      throw new Error(
        "نتیجهٔ ساخت خانه تأیید نشد؛ ممکن است خانه‌ای ساخته شده باشد. وضعیت خانه را بررسی کنید.",
      );
    const target = copied.data;
    householdCopy = true;
    for (const name of TABLES)
      for (const row of tables[name])
        if (row.household_id === source) row.household_id = target;
    current = await client.rpc("mobile_export_snapshot");
    if (
      current.error ||
      !current.data?.tables ||
      !Array.isArray(current.data.tables.households) ||
      !Array.isArray(current.data.tables.household_members)
    )
      throw new Error(
        "خانه ممکن است ساخته شده باشد، اما بررسی مجدد آن ناموفق بود.",
      );
    tables.households = current.data.tables.households.filter(
      (row: Row) => row.id === target,
    );
    tables.household_members = current.data.tables.household_members.filter(
      (row: Row) =>
        row.household_id === target &&
        row.user_id === user &&
        row.left_at === null,
    );
    if (tables.households.length !== 1 || tables.household_members.length !== 1)
      throw new Error("خانه ساخته شده است، اما عضویت مالک تأیید نشد.");
  }
  for (const [table, key] of Object.entries(READ_ONLY)) {
    if (
      signed &&
      (table === "profiles" ||
        table === "household_members" ||
        table === "task_recurrence_instances" ||
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
  // Only an owner, authenticated against the original signed snapshot and
  // still owner now, can restore genuine shared data authored by others.
  const activeOwner = (current.data.tables.household_members as Row[]).find(
    (row) =>
      row.user_id === user && row.role === "OWNER" && row.left_at === null,
  );
  const targetHome = activeOwner?.household_id;
  const sharedMode =
    !!signed &&
    !!sourceHouse &&
    signedOwner &&
    typeof targetHome === "string" &&
    tables.households.length === 1 &&
    tables.households[0].id === targetHome;
  // Membership is never silently re-created. Count absent active members even
  // if they had no assignments, so the UI cannot call a partial recovery full.
  const currentMembers = current.data.tables.household_members as Row[];
  let deferred =
    signed && sourceHouse
      ? originalMembers.filter(
          (row) =>
            row.household_id === sourceHouse &&
            row.left_at === null &&
            row.user_id !== user &&
            !currentMembers.some(
              (m) =>
                m.user_id === row.user_id &&
                m.household_id === targetHome &&
                m.left_at === null,
            ),
        ).length
      : 0;
  if (sharedMode) {
    const sharedTasks = new Set(
      tables.tasks
        .filter(
          (r) =>
            r.household_id === targetHome &&
            r.visibility === "HOUSEHOLD_SHARED",
        )
        .map((r) => r.id),
    );
    const sharedChores = new Set(
      tables.chores
        .filter((r) => r.household_id === targetHome)
        .map((r) => r.id),
    );
    const sharedLists = new Set(
      tables.shopping_lists
        .filter((r) => r.household_id === targetHome)
        .map((r) => r.id),
    );
    for (const name of [
      "tasks",
      "events",
      "chores",
      "shopping_lists",
      "financial_records",
    ])
      tables[name] = tables[name].filter(
        (row) => row.household_id !== targetHome,
      );
    tables.task_assignees = tables.task_assignees.filter(
      (row) => !sharedTasks.has(row.task_id),
    );
    tables.task_recurrences = tables.task_recurrences.filter(
      (row) => !sharedTasks.has(row.task_id),
    );
    tables.chore_rotation_steps = tables.chore_rotation_steps.filter(
      (row) => !sharedChores.has(row.chore_id),
    );
    tables.shopping_items = tables.shopping_items.filter(
      (row) => !sharedLists.has(row.list_id),
    );
    const currentDocuments = current.data.tables.documents;
    if (!Array.isArray(currentDocuments))
      throw new Error("بررسی مدارک فعلی ناموفق بود.");
    const kept: Row[] = [];
    for (const row of tables.documents) {
      if (row.created_by === user) {
        kept.push(row);
        continue;
      }
      const existing = currentDocuments.find((d: Row) => d.id === row.id);
      if (!existing) {
        deferred++;
        continue;
      }
      if (
        existing.household_id !== targetHome ||
        existing.visibility !== "HOUSEHOLD_SHARED" ||
        existing.created_by !== row.created_by ||
        typeof existing.storage_path !== "string"
      )
        throw new Error("اطلاعات مدرک موجود با نسخه پشتیبان سازگار نیست.");
      if ((await currentUser(client)) !== user)
        throw new Error("حساب در حین بازیابی تغییر کرد؛ عملیات متوقف شد.");
      const file = await client.storage
        .from("documents")
        .download(existing.storage_path);
      if (file.error || !file.data) deferred++;
    }
    tables.documents = kept;
    // Authentic attachment metadata is restored by the guarded shared phase;
    // unavailable document/entity parents are reported as deferred there.
    tables.document_attachments = [];
  }
  // Detect known RLS failures before staging any Storage objects. The server
  // still independently enforces RLS; this is only an early diagnostic.
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
      : await availableRestorePath(
          client,
          `${prefix}/${row.id}/restore.${ext}`,
        );
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
  let sharedInserted = 0,
    sharedSkipped = 0;
  async function restoreShared(phase: "parents" | "children") {
    if (!sharedMode || !signed || !sourceHouse) return;
    if ((await currentUser(client)) !== user)
      throw new Error(
        "حساب تغییر کرد؛ بخشی از داده‌ها ممکن است ثبت شده باشند.",
      );
    const result = await client.rpc("mobile_restore_signed_shared", {
      p_payload: signed.payload,
      p_signature: signed.signature,
      p_source: sourceHouse,
      p_phase: phase,
    });
    if (
      result.error ||
      !result.data ||
      !Number.isSafeInteger(result.data.inserted) ||
      !Number.isSafeInteger(result.data.skipped) ||
      !Number.isSafeInteger(result.data.deferred)
    )
      throw new Error(
        "نتیجهٔ بازیابی دادهٔ مشترک تأیید نشد؛ ممکن است بخشی ثبت شده باشد. پیش از تلاش دوباره فهرست‌ها را بررسی کنید.",
      );
    sharedInserted += result.data.inserted;
    sharedSkipped += result.data.skipped;
    deferred += result.data.deferred;
  }
  await restoreShared("parents");
  const v2ReminderTypes = new Set(["DOCUMENT", "APPLIANCE", "MEAL"]);
  const restoreTables = signed
    ? {
        ...tables,
        reminders: tables.reminders.filter(
          (r) => !v2ReminderTypes.has(String(r.target_type ?? "")),
        ),
        document_attachments: tables.document_attachments.filter(
          (r) => r.entity_type !== "APPLIANCE",
        ),
        household_members: [],
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
  await restoreShared("children");
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
  let mealInserted = 0,
    mealSkipped = 0;
  if (hasMeals && backup.tables.meal_plans.length) {
    if (!signed || !sourceHouse || (await currentUser(client)) !== user)
      throw new Error(
        "حساب یا خانه برای بازیابی برنامه غذایی معتبر نیست؛ داده‌های دیگر ممکن است ثبت شده باشند.",
      );
    const meals = await client.rpc("mobile_restore_signed_meals", {
      p_payload: signed.payload,
      p_signature: signed.signature,
      p_source: sourceHouse,
    });
    if (
      meals.error ||
      !meals.data ||
      !Number.isSafeInteger(meals.data.inserted) ||
      !Number.isSafeInteger(meals.data.skipped) ||
      !Number.isSafeInteger(meals.data.deferred)
    )
      throw new Error(
        "بازیابی برنامه غذایی تأیید نشد؛ ممکن است بخشی از داده‌ها ثبت شده باشند. پیش از تلاش دوباره بررسی کنید.",
      );
    mealInserted = meals.data.inserted;
    mealSkipped = meals.data.skipped;
    deferred += meals.data.deferred;
  }
  let v3Inserted = 0,
    v3Skipped = 0;
  if (hasHomeV3) {
    if (!signed || (await currentUser(client)) !== user)
      throw new Error(
        "حساب برای بازیابی نسخهٔ جدید معتبر نیست؛ داده‌های دیگر ممکن است ثبت شده باشند.",
      );
    const v3 = await client.rpc("mobile_restore_signed_home_v3", {
      p_payload: signed.payload,
      p_signature: signed.signature,
      p_source: sourceHouse,
    });
    if (
      v3.error ||
      !v3.data ||
      !Number.isSafeInteger(v3.data.inserted) ||
      !Number.isSafeInteger(v3.data.skipped) ||
      !Number.isSafeInteger(v3.data.deferred)
    )
      throw new Error(
        "بازیابی داده‌های وسایل و تمدید مدارک تأیید نشد؛ پیش از تلاش دوباره فهرست‌ها را بررسی کنید.",
      );
    v3Inserted = v3.data.inserted;
    v3Skipped = v3.data.skipped;
    deferred += v3.data.deferred;
  }
  return {
    inserted:
      data.inserted +
      historyInserted +
      sharedInserted +
      mealInserted +
      v3Inserted,
    skipped:
      data.skipped + historySkipped + sharedSkipped + mealSkipped + v3Skipped,
    deferred,
    repairedFiles: uploads.filter((item) => item.repair).length,
    householdCopy,
  };
}
