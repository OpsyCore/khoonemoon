export type DocumentExpiryStatus =
  "NO_EXPIRY" | "VALID" | "EXPIRING_SOON" | "EXPIRED";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalNoon(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return NaN;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0,
    0,
  ).getTime();
}

export function daysUntilExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null;
  const target = parseLocalNoon(expiresAt);
  if (!Number.isFinite(target)) return null;
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  ).getTime();
  return Math.round((target - today) / DAY_MS);
}

export function getDocumentExpiryStatus(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
  soonDays = 30,
): DocumentExpiryStatus {
  const days = daysUntilExpiry(expiresAt, now);
  if (days === null) return "NO_EXPIRY";
  if (days < 0) return "EXPIRED";
  if (days <= soonDays) return "EXPIRING_SOON";
  return "VALID";
}

export function documentNeedsRenewal(
  doc: {
    expires_at?: string | null;
    renewal_required?: boolean;
  },
  now: Date = new Date(),
): boolean {
  if (doc.renewal_required) return true;
  const status = getDocumentExpiryStatus(doc.expires_at, now);
  return status === "EXPIRING_SOON" || status === "EXPIRED";
}

export function describeDocumentExpiry(
  doc: {
    expires_at?: string | null;
    renewal_required?: boolean;
  },
  now: Date = new Date(),
): { status: DocumentExpiryStatus; label: string; days: number | null } {
  const days = daysUntilExpiry(doc.expires_at, now);
  const status = getDocumentExpiryStatus(doc.expires_at, now);
  if (status === "NO_EXPIRY") {
    return {
      status,
      days: null,
      label: doc.renewal_required ? "نیازمند تمدید" : "بدون تاریخ انقضا",
    };
  }
  if (status === "EXPIRED") {
    return {
      status,
      days,
      label:
        days === -1
          ? "دیروز منقضی شده"
          : `${Math.abs(days!)} روز از انقضا گذشته`,
    };
  }
  if (days === 0) {
    return { status, days, label: "انقضا امروز" };
  }
  if (status === "EXPIRING_SOON") {
    return { status, days, label: `${days} روز تا انقضا` };
  }
  return { status, days, label: `معتبر (${days} روز مانده)` };
}

/** Local 09:00 on the document's expiry day, used as baseDateTime for 30/7/1 day offsets. */
export function documentExpiryReminderBase(expiresAt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresAt);
  if (!m) throw new Error("تاریخ انقضا معتبر نیست.");
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    9,
    0,
    0,
    0,
  ).toISOString();
}
