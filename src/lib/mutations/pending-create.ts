/**
 * Reuse a client-generated row UUID after an ambiguous create response.
 * The persistent journal holds only a hash of the input and the UUID, not the
 * submitted data. A subsequent identical attempt checks the same row instead
 * of creating another one. This is for single-row inserts with client IDs only.
 */
const prefix = "khoonemoon.pending-create.v1.";
const memory = new Map<string, string>();

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
async function acquire(user: string, kind: string, input: unknown) {
  const key = await journalKey(user, kind, input);
  const run = () => acquireFromJournal(key);
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(key, run);
  return run();
}
function acquireFromJournal(key: string) {
  const storage = journal();
  let id: string;
  try {
    const previous = storage.getItem(key);
    id =
      previous &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        previous,
      )
        ? previous
        : crypto.randomUUID();
    storage.setItem(key, id);
    if (storage.getItem(key) !== id) throw new Error("journal unavailable");
  } catch {
    throw new Error("برای ثبت امن، ذخیره‌سازی دستگاه باید فعال باشد.");
  }
  const clear = () => {
    try {
      if (storage.getItem(key) === id) storage.removeItem(key);
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
}: {
  user: string;
  kind: string;
  input: unknown;
  submit: (id: string) => PromiseLike<Result<T>>;
  valid: (data: unknown) => data is T;
}): Promise<T> {
  const { id, clear } = await acquire(user, kind, input);
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
}: {
  user: string;
  kind: string;
  input: unknown;
  submit: (id: string) => PromiseLike<Result<T>>;
  find: (id: string) => PromiseLike<Result<T>>;
}): Promise<T> {
  const { id, clear } = await acquire(user, kind, input);
  const done = (data: T) => {
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
