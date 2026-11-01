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
