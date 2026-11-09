import { describe, expect, it } from "vitest";
import {
  daysUntilExpiry,
  describeDocumentExpiry,
  documentExpiryReminderBase,
  documentNeedsRenewal,
  getDocumentExpiryStatus,
} from "./expiry";

describe("document expiry & renewal status", () => {
  const now = new Date(2026, 9, 28, 12, 0, 0); // 2026-10-28 local

  it("derives remaining days and status across valid, soon, expired, and dateless documents", () => {
    expect(daysUntilExpiry(null, now)).toBeNull();
    expect(getDocumentExpiryStatus(null, now)).toBe("NO_EXPIRY");

    expect(daysUntilExpiry("2026-12-10", now)).toBe(43);
    expect(getDocumentExpiryStatus("2026-12-10", now)).toBe("VALID");

    expect(daysUntilExpiry("2026-11-04", now)).toBe(7);
    expect(getDocumentExpiryStatus("2026-11-04", now)).toBe("EXPIRING_SOON");

    expect(daysUntilExpiry("2026-10-20", now)).toBe(-8);
    expect(getDocumentExpiryStatus("2026-10-20", now)).toBe("EXPIRED");
  });

  it("separates manual renewal flag from computed expiry without contradiction", () => {
    expect(
      documentNeedsRenewal(
        { expires_at: "2027-06-01", renewal_required: true },
        now,
      ),
    ).toBe(true);
    expect(
      describeDocumentExpiry({ expires_at: null, renewal_required: true }, now)
        .label,
    ).toBe("نیازمند تمدید");
    expect(new Date(documentExpiryReminderBase("2026-11-28")).getHours()).toBe(
      9,
    );
  });
});
