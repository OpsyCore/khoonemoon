import { describe, expect, it, vi } from "vitest";
import { reloadAfterSave } from "../../../mobile/src/after-save";
describe("reload after a confirmed write", () => {
  it("reports successful refresh", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    expect(await reloadAfterSave(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("distinguishes refresh failure without retrying the mutation", async () => {
    const reload = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await reloadAfterSave(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
