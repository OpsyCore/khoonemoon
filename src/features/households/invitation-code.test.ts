import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateInvitationCode,
  hashInvitationCode,
} from "@/features/households/invitation-code";

describe("invitation codes", () => {
  it("generates unique non-empty codes", () => {
    const first = generateInvitationCode();
    const second = generateInvitationCode();
    expect(first.length).toBeGreaterThan(12);
    expect(second.length).toBeGreaterThan(12);
    expect(first).not.toBe(second);
  });

  it("hashes invitation codes with sha256 hex", () => {
    const code = "test-invite-code";
    expect(hashInvitationCode(code)).toBe(
      createHash("sha256").update(code).digest("hex"),
    );
  });
});
