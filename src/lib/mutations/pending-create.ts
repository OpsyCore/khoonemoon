/**
 * Reuse a client-generated row UUID after an ambiguous create response.
 * The persistent journal holds only a hash of the input and the UUID, not the
 * submitted data. A subsequent identical attempt checks the same row instead
 * of creating another one. This is for single-row inserts with client IDs only.
 */
const prefix = "khoonemoon.pending-create.v1.";
const memory = new Map<string, string>();
const indexPrefix = "khoonemoon.pending-transfer.v1.";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;
const kindPattern = /^[a-z][a-z0-9-]{0,39}$/;

function journal(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (typeof window === "undefined") {
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    };
  }
  try {
    return window.localStorage;
  } catch {
    throw new Error("برای ثبت امن، ذخیره‌سازی دستگاه باید فعال باشد.");
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
async function journalKey(user: string, kind: string, input: unknown) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID)
    throw new Error("ثبت امن در این دستگاه پشتیبانی نمی‌شود.");
  const bytes = new TextEncoder().encode(
    JSON.stringify(canonical([user, kind, input])),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return (
    prefix +
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
  );
}

type Result<T> = { data: T | null; error: unknown };
async function acquire(
  user: string,
  kind: string,
  input: unknown,
  requestId?: string,
) {
  const key = await journalKey(user, kind, input);
  const run = () => acquireFromJournal(key, user, kind, requestId);
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(key, run);
  return run();
}
function acquireFromJournal(
  key: string,
  user: string,
  kind: string,
  requestId?: string,
) {
  const storage = journal();
  let id: string;
  try {
    if (requestId && !uuidPattern.test(requestId))
      throw new Error("invalid request id");
    const previous = storage.getItem(key);
    if (requestId && previous && previous !== requestId)
      throw new Error("request id conflict");
    id =
      requestId ??
      (previous && uuidPattern.test(previous) ? previous : crypto.randomUUID());
    storage.setItem(key, id);
    if (storage.getItem(key) !== id) throw new Error("journal unavailable");
    // Metadata contains no form values. It makes an uncertain operation
    // explicitly transferable to another device signed into the same account.
    if (/^[0-9a-f-]{36}$/i.test(user) && kindPattern.test(kind)) {
      const metaKey = indexPrefix + user + "." + key.slice(prefix.length);
      storage.setItem(metaKey, JSON.stringify({ kind, id }));
      if (!storage.getItem(metaKey)) throw new Error("journal unavailable");
    }
  } catch {
    throw new Error("برای ثبت امن، ذخیره‌سازی دستگاه باید فعال باشد.");
  }
  const clear = () => {
    try {
      if (storage.getItem(key) === id) {
        storage.removeItem(key);
        storage.removeItem(indexPrefix + user + "." + key.slice(prefix.length));
      }
    } catch {
      /* Keeping the id prevents duplicates. */
    }
  };
  return { id, clear };
}

export async function pendingRequest<T>({
  user,
  kind,
  input,
  submit,
  valid,
  requestId,
}: {
  user: string;
  kind: string;
  input: unknown;
  submit: (id: string) => PromiseLike<Result<T>>;
  valid: (data: unknown) => data is T;
  requestId?: string;
}): Promise<T> {
  const { id, clear } = await acquire(user, kind, input, requestId);
  try {
    const result = await submit(id);
    if (!result.error && valid(result.data)) {
      clear();
      return result.data;
    }
  } catch {
    /* A failed response may still mean a committed request. */
  }
  throw new Error(
    "نتیجهٔ ثبت مشخص نیست؛ فهرست را تازه کنید. برای تلاش دوباره همین اطلاعات را ارسال کنید تا ثبت تکراری ایجاد نشود.",
  );
}
export async function pendingCreate<T>({
  user,
  kind,
  input,
  submit,
  find,
  onConfirmed,
  requestId,
}: {
  user: string;
  kind: string;
  input: unknown;
  submit: (id: string) => PromiseLike<Result<T>>;
  find: (id: string) => PromiseLike<Result<T>>;
  onConfirmed?: (data: T) => void;
  requestId?: string;
}): Promise<T> {
  const { id, clear } = await acquire(user, kind, input, requestId);
  const done = (data: T) => {
    onConfirmed?.(data);
    clear();
    return data;
  };
  try {
    const result = await submit(id);
    if (!result.error && result.data) return done(result.data);
  } catch {
    /* The write may still commit; keep the journal entry. */
  }
  try {
    const existing = await find(id);
    if (
      !existing.error &&
      existing.data &&
      typeof existing.data === "object" &&
      "id" in existing.data &&
      existing.data.id === id
    )
      return done(existing.data);
  } catch {
    /* The result remains unknown. */
  }
  throw new Error(
    "نتیجهٔ ثبت مشخص نیست؛ فهرست را تازه کنید. برای تلاش دوباره همین اطلاعات را ارسال کنید تا ثبت تکراری ایجاد نشود.",
  );
}

/** Stable child IDs for one atomic batch; index is bounded by the caller. */
export async function pendingChildId(
  operation: string,
  index: number,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${operation}:${index}`),
    ),
  );
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.subarray(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Codes contain a digest and request identifier, not the submitted fields.
 * Transfer only between trusted devices. A code is not an authorization token;
 * Supabase authentication and RLS still apply. */
export function listPendingTransferCodes(
  user: string,
): { kind: string; code: string }[] {
  if (typeof window === "undefined" || !/^[0-9a-f-]{36}$/i.test(user))
    return [];
  const store = window.localStorage;
  const start = indexPrefix + user + ".";
  const result: { kind: string; code: string }[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(start)) continue;
    const digest = key.slice(start.length);
    try {
      const item = JSON.parse(store.getItem(key) ?? "null");
      if (
        !digestPattern.test(digest) ||
        !kindPattern.test(item?.kind) ||
        !uuidPattern.test(item?.id) ||
        store.getItem(prefix + digest) !== item.id
      )
        continue;
      const payload = JSON.stringify({
        v: 1,
        user,
        kind: item.kind,
        digest,
        id: item.id,
      });
      result.push({
        kind: item.kind,
        code:
          "KHM1." +
          btoa(payload)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, ""),
      });
    } catch {
      /* malformed entry is not exported */
    }
  }
  return result;
}

export async function importPendingTransferCode(
  user: string,
  code: string,
): Promise<void> {
  if (
    typeof window === "undefined" ||
    code.length > 1000 ||
    !/^KHM1\.[A-Za-z0-9_-]+$/.test(code)
  )
    throw new Error("کد انتقال معتبر نیست.");
  let value: unknown;
  try {
    const encoded = code.slice(5).replace(/-/g, "+").replace(/_/g, "/");
    value = JSON.parse(atob(encoded));
  } catch {
    throw new Error("کد انتقال معتبر نیست.");
  }
  if (!value || typeof value !== "object")
    throw new Error("کد انتقال معتبر نیست.");
  const item = value as Record<string, unknown>;
  if (
    item.v !== 1 ||
    item.user !== user ||
    typeof item.kind !== "string" ||
    !kindPattern.test(item.kind) ||
    typeof item.digest !== "string" ||
    !digestPattern.test(item.digest) ||
    typeof item.id !== "string" ||
    !uuidPattern.test(item.id)
  )
    throw new Error("کد معتبر نیست یا متعلق به حساب دیگری است.");
  const key = prefix + item.digest;
  const meta = indexPrefix + user + "." + item.digest;
  const id = item.id,
    kind = item.kind;
  const save = () => {
    const store = window.localStorage;
    const existing = store.getItem(key);
    if (existing && existing !== id)
      throw new Error(
        "در این دستگاه یک درخواست نامشخص دیگر با همین اطلاعات وجود دارد؛ هیچ‌کدام جایگزین نشد.",
      );
    store.setItem(key, id);
    store.setItem(meta, JSON.stringify({ kind, id }));
    if (store.getItem(key) !== id || !store.getItem(meta))
      throw new Error("ذخیره کد در دستگاه تأیید نشد.");
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    await navigator.locks.request(key, save);
  else save();
}
