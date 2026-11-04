import { describe, expect, it, vi } from "vitest";
import { availableRestorePath } from "./restore-path";

describe("restore paths after cleanup", () => {
  it("uses the existing deterministic path when it is not retired", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    };
    expect(
      await availableRestorePath(client as never, "user/u/id/restore.pdf"),
    ).toBe("user/u/id/restore.pdf");
  });
  it("uses a fresh name after retirement and fails closed when the status is unknown", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: {} });
    const client = { rpc };
    expect(
      await availableRestorePath(client as never, "user/u/id/restore.pdf"),
    ).toMatch(/^user\/u\/id\/restore-[0-9a-f-]{36}\.pdf$/);
    await expect(
      availableRestorePath(client as never, "user/u/id/restore.pdf"),
    ).rejects.toThrow();
  });
});
