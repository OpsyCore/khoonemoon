import {
  generateInvitationCodeBrowser,
  hashInvitationCodeBrowser,
} from "./invitation-browser";

/** The pending code is a bearer secret kept on this device only until the
 * server confirms creation. Do not log it or put it in the request URL. */
const prefix = "khoonemoon.pending-invitation.v1.";
const memory = new Map<string, string>();
function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (typeof window === "undefined")
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    };
  try {
    return window.localStorage;
  } catch {
    throw new Error("برای ثبت امن، ذخیره‌سازی دستگاه باید فعال باشد.");
  }
}
type Pending = { code: string; expiresAt: string };
export async function pendingInvitation(
  user: string,
  household: string,
  send: (hash: string, expiresAt: string) => Promise<boolean>,
): Promise<Pending> {
  const key = prefix + user + "." + household;
  const run = async () => {
    const store = storage();
    let pending: Pending;
    try {
      const raw = store.getItem(key);
      const existing = raw ? (JSON.parse(raw) as Pending) : null;
      if (
        existing &&
        /^[A-Za-z0-9_-]{32}$/.test(existing.code) &&
        Number.isFinite(Date.parse(existing.expiresAt)) &&
        Date.parse(existing.expiresAt) > Date.now()
      )
        pending = existing;
      else
        pending = {
          code: generateInvitationCodeBrowser(),
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        };
      store.setItem(key, JSON.stringify(pending));
      if (store.getItem(key) !== JSON.stringify(pending))
        throw new Error("storage unavailable");
    } catch {
      throw new Error("برای ثبت امن، ذخیره‌سازی دستگاه باید فعال باشد.");
    }
    const hash = await hashInvitationCodeBrowser(pending.code);
    try {
      if (await send(hash, pending.expiresAt)) {
        if (store.getItem(key) === JSON.stringify(pending))
          store.removeItem(key);
        return pending;
      }
    } catch {
      /* request may have committed */
    }
    throw new Error(
      "نتیجهٔ دعوت مشخص نیست؛ برای تلاش دوباره همین دکمه را بزنید.",
    );
  };
  // Web Locks serialize tabs sharing an origin where supported. The database
  // still serializes retries that carry the same hash across any devices.
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(key, run);
  return run();
}

/** A pending invitation transfer contains the bearer invite code. Treat it as
 * sensitive and transfer it only between the owner's trusted devices. */
export function exportPendingInvitation(
  user: string,
  household: string,
): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(prefix + user + "." + household);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Pending;
    if (
      !/^[A-Za-z0-9_-]{32}$/.test(value.code) ||
      !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= Date.now()
    )
      return null;
    return (
      "KHI1." +
      btoa(JSON.stringify({ v: 1, user, household, ...value }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    );
  } catch {
    return null;
  }
}
export async function importPendingInvitation(
  user: string,
  household: string,
  code: string,
): Promise<void> {
  if (
    typeof window === "undefined" ||
    code.length > 1500 ||
    !/^KHI1\.[A-Za-z0-9_-]+$/.test(code)
  )
    throw new Error("کد انتقال دعوت معتبر نیست.");
  let item: Record<string, unknown>;
  try {
    item = JSON.parse(
      atob(code.slice(5).replace(/-/g, "+").replace(/_/g, "/")),
    );
  } catch {
    throw new Error("کد انتقال دعوت معتبر نیست.");
  }
  if (
    !item ||
    item.v !== 1 ||
    item.user !== user ||
    item.household !== household ||
    typeof item.code !== "string" ||
    !/^[A-Za-z0-9_-]{32}$/.test(item.code) ||
    typeof item.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(item.expiresAt)) ||
    Date.parse(item.expiresAt) <= Date.now() ||
    Date.parse(item.expiresAt) > Date.now() + 168 * 60 * 60 * 1000
  )
    throw new Error(
      "کد دعوت معتبر نیست، منقضی شده یا متعلق به خانه دیگری است.",
    );
  const key = prefix + user + "." + household;
  const pending = JSON.stringify({
    code: item.code,
    expiresAt: item.expiresAt,
  });
  const save = () => {
    const store = window.localStorage;
    const previous = store.getItem(key);
    if (previous && previous !== pending)
      throw new Error(
        "دعوت نامشخص دیگری در دستگاه وجود دارد؛ هیچ‌کدام جایگزین نشد.",
      );
    store.setItem(key, pending);
    if (store.getItem(key) !== pending)
      throw new Error("ذخیره کد دعوت تأیید نشد.");
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    await navigator.locks.request(key, save);
  else save();
}
