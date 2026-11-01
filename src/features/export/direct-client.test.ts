import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportMobileData } from "./direct-client";
import { csvEscape } from "./archive";
function fixture(errorTable?: string) {
  const ranges: Array<[string, number, number]> = [];
  const from = vi.fn((table: string) => ({
    select: () => ({
      order: () => ({
        range: async (start: number, end: number) => {
          ranges.push([table, start, end]);
          return {
            data:
              table === "financial_records"
                ? [
                    {
                      id: "f1",
                      record_type: "EXPENSE",
                      title: "=1+1",
                      amount: 100,
                      currency: "IRR",
                      occurred_at: "2026-01-01",
                    },
                  ]
                : [],
            error: table === errorTable ? {} : null,
          };
        },
      }),
    }),
  }));
  return { client: { from } as unknown as SupabaseClient, ranges, from };
}
describe("mobile archive", () => {
  it("includes authorized table results and explains document files are excluded", async () => {
    const { client, ranges } = fixture();
    const archive = JSON.parse(
      await exportMobileData(client, "json", new Date("2026-01-01")),
    );
    expect(archive.tables.financial_records).toHaveLength(1);
    expect(archive.tables.documents).toEqual([]);
    expect(archive.note).toContain("فایل‌های مدارک");
    expect(ranges).toHaveLength(19);
    expect(archive.tables.profiles).toEqual([]);
    expect(archive.tables.households).toEqual([]);
    expect(archive.tables.household_members).toEqual([]);
    expect(archive.tables.task_recurrence_instances).toEqual([]);
    expect(archive.tables.finance_recurrence_instances).toEqual([]);
    expect(archive.tables.task_recurrences).toEqual([]);
    expect(archive.tables.chore_rotation_steps).toEqual([]);
    expect(archive.tables.document_attachments).toEqual([]);
  });
  it("fails instead of silently producing a partial archive", async () => {
    const { client } = fixture("tasks");
    await expect(
      exportMobileData(client, "json", new Date()),
    ).rejects.toThrow();
  });
  it("limits CSV to finance and neutralizes formula text", async () => {
    const { client, ranges } = fixture();
    const csv = await exportMobileData(client, "csv", new Date());
    expect(csv).toContain("'=1+1");
    expect(ranges.map((r) => r[0])).toEqual(["financial_records"]);
  });
  it("does not turn negative numbers into formulas while protecting textual markers", () => {
    expect(csvEscape(-20)).toBe("-20");
    expect(csvEscape("  +SUM(A1) ")).toBe("'  +SUM(A1) ");
    expect(csvEscape("@test")).toBe("'@test");
  });
});

describe("document backup", () => {
  it("includes each accessible file with an ID-based path and consistent manifest", async () => {
    const { unzipSync, strFromU8 } = await import("fflate");
    const { exportMobileBackup } = await import("./direct-client");
    const id = "11111111-1111-4111-8111-111111111111";
    const download = vi
      .fn()
      .mockResolvedValue({ data: new Blob(["file"]), error: null });
    const from = vi.fn((table: string) => ({
      select: () => ({
        order: () => ({
          range: async () => ({
            data:
              table === "documents"
                ? [
                    {
                      id,
                      storage_path: "user/me/x.pdf",
                      mime_type: "application/pdf",
                      file_size: 4,
                      title: "مدرک",
                    },
                  ]
                : [],
            error: null,
          }),
        }),
      }),
    }));
    const client = {
      from,
      storage: { from: () => ({ download }) },
    } as unknown as SupabaseClient;
    const bytes = await exportMobileBackup(client, new Date("2026-01-01"));
    const { inspectBackup } = await import("./backup-integrity");
    expect(await inspectBackup(bytes)).toMatchObject({
      documents: 1,
      integrity: "verified",
    });
    const zip = unzipSync(bytes);
    expect(strFromU8(zip[`documents/${id}.pdf`])).toBe("file");
    const manifest = JSON.parse(strFromU8(zip["archive.json"]));
    expect(manifest.tables.documents[0].archive_file).toBe(
      `documents/${id}.pdf`,
    );
    expect(manifest.tables.documents[0].storage_path).toBeUndefined();
    expect(download).toHaveBeenCalledWith("user/me/x.pdf");
  });
  it("fails instead of creating a partial backup when any file cannot be read", async () => {
    const { exportMobileBackup } = await import("./direct-client");
    const id = "11111111-1111-4111-8111-111111111111";
    const from = vi.fn((table: string) => ({
      select: () => ({
        order: () => ({
          range: async () => ({
            data:
              table === "documents"
                ? [
                    {
                      id,
                      storage_path: "user/me/x.pdf",
                      mime_type: "application/pdf",
                      file_size: 4,
                    },
                  ]
                : [],
            error: null,
          }),
        }),
      }),
    }));
    const client = {
      from,
      storage: {
        from: () => ({
          download: async () => ({ data: null, error: { message: "denied" } }),
        }),
      },
    } as unknown as SupabaseClient;
    await expect(exportMobileBackup(client, new Date())).rejects.toThrow(
      "ناقص",
    );
  });
});
