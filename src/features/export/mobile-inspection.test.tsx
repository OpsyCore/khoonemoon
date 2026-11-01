// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { webcrypto } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChecksums } from "./backup-integrity";
import { encryptBackup } from "./backup-encryption";
import { ExportData } from "../../../mobile/src/export";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
describe("local backup preview", () => {
  it("inspects a selected file locally without calling Supabase or restoring anything", async () => {
    const files: Record<string, Uint8Array> = {
      "archive.json": strToU8(
        JSON.stringify({
          exported_at: "2026-01-01T00:00:00Z",
          tables: { documents: [], tasks: [{ id: "1" }] },
          counts: { documents: 0, tasks: 1 },
        }),
      ),
    };
    files["checksums.json"] = await buildChecksums(files);
    const bytes = zipSync(files, { level: 0 });
    const div = document.createElement("div");
    document.body.append(div);
    const root = createRoot(div);
    const from = vi.fn();
    await act(async () =>
      root.render(
        <ExportData client={{ from } as unknown as SupabaseClient} />,
      ),
    );
    const input = div.querySelector("input[type=file]")! as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [{ size: bytes.length, arrayBuffer: async () => bytes.buffer }],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(div.textContent).toContain("یکپارچگی محتوا با SHA-256 بررسی شد");
    });
    expect(div.textContent).toContain("این بررسی بازیابی داده نیست");
    expect(from).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    div.remove();
  });
  it("opens an encrypted backup only after entering its password", async () => {
    const files: Record<string, Uint8Array> = {
      "archive.json": strToU8(
        JSON.stringify({
          exported_at: "2026-01-01T00:00:00Z",
          tables: { documents: [] },
          counts: { documents: 0 },
        }),
      ),
    };
    files["checksums.json"] = await buildChecksums(files);
    const bytes = await encryptBackup(
      zipSync(files, { level: 0 }),
      "long backup password",
    );
    const div = document.createElement("div");
    document.body.append(div);
    const root = createRoot(div);
    const from = vi.fn();
    await act(async () =>
      root.render(
        <ExportData client={{ from } as unknown as SupabaseClient} />,
      ),
    );
    const fileInput = div.querySelector(
      "input[type=file]",
    )! as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [{ size: bytes.length, arrayBuffer: async () => bytes.buffer }],
    });
    await act(async () =>
      fileInput.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(div.textContent).toContain("رمز این پشتیبان");
    expect(div.textContent).not.toContain("یکپارچگی محتوا با SHA-256 بررسی شد");
    const passwords = div.querySelectorAll<HTMLInputElement>(
      "input[type=password]",
    );
    const passwordInput = passwords[passwords.length - 1];
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setter.call(passwordInput, "long backup password");
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const open = [...div.querySelectorAll("button")].find(
      (b) => b.textContent === "باز کردن و بررسی",
    )!;
    await act(async () => {
      open.click();
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });
    expect(div.textContent).toContain("یکپارچگی محتوا با SHA-256 بررسی شد");
    expect(from).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    div.remove();
  });
});
