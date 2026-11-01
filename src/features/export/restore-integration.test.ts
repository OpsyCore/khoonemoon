import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportMobileBackup } from "./direct-client";
import { restoreMissing } from "./restore-client";
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
const user = "11111111-1111-4111-8111-111111111111",
  doc = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const original = `user/${user}/${doc}/original.pdf`;
const sanitize = (sql: string) =>
  sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\.*$/gm, "");

describe("real ZIP through recovery against isolated PGlite", () => {
  it("exports, deletes, restores and retries without overwriting", async () => {
    const db = await PGlite.create();
    try {
      for (const file of [
        "db/local/00_auth_shim.sql",
        ...readdirSync("drizzle")
          .filter((x) => x.endsWith(".sql"))
          .sort()
          .map((x) => `drizzle/${x}`),
      ])
        await db.exec(sanitize(readFileSync(file, "utf8")));
      await db.exec(`insert into auth.users(id,email) values ('${user}','restore@example.com');
     select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',false); set role authenticated;
     insert into public.tasks(title,creator_id,owner_id,visibility,priority) values ('بازگشت کار','${user}','${user}','PRIVATE','NORMAL');
     insert into public.tasks(title,creator_id,owner_id,visibility,priority) select 'کار اضافی '||g,'${user}','${user}','PRIVATE','NORMAL' from generate_series(1,600) g;
     insert into storage.objects(bucket_id,name) values ('documents','${original}');
     insert into public.documents(id,created_by,title,mime_type,file_size,storage_path,visibility) values ('${doc}','${user}','مدرک','application/pdf',3,'${original}','PRIVATE');`);
      const objects = new Map<string, Uint8Array>([
        [original, new Uint8Array([1, 2, 3])],
      ]);
      const bucket = {
        download: async (path: string) => ({
          data: objects.has(path)
            ? new Blob([new Uint8Array(objects.get(path)!)])
            : null,
          error: objects.has(path) ? null : { message: "not found" },
        }),
        upload: async (path: string, blob: Blob) => {
          if (objects.has(path))
            return { error: { message: "already exists" } };
          const data = new Uint8Array(await blob.arrayBuffer());
          await db.query(
            "insert into storage.objects(bucket_id,name) values ('documents',$1)",
            [path],
          );
          objects.set(path, data);
          // Simulate a lost response after the object was committed.
          return { error: { message: "timeout" } };
        },
      };
      const client = {
        auth: {
          getUser: async () => ({ data: { user: { id: user } }, error: null }),
        },
        storage: { from: () => bucket },
        rpc: async (name: string, args?: { p_tables: unknown }) => {
          try {
            const result =
              name === "mobile_export_snapshot"
                ? await db.query(
                    "select public.mobile_export_snapshot() as value",
                  )
                : await db.query(
                    "select public.mobile_restore_missing($1::jsonb) as value",
                    [JSON.stringify(args?.p_tables)],
                  );
            return {
              data: (result.rows[0] as { value: unknown }).value,
              error: null,
            };
          } catch (error) {
            return { data: null, error };
          }
        },
      } as unknown as SupabaseClient;
      const zip = await exportMobileBackup(
        client,
        new Date("2026-01-01T00:00:00Z"),
      );
      await db.exec(
        `delete from public.tasks; delete from public.documents where id='${doc}'; delete from storage.objects where name='${original}';`,
      );
      objects.delete(original);
      const result = await restoreMissing(client, zip);
      expect(result.inserted).toBe(602);
      const tasks = await db.query(
        "select count(*)::int as total from public.tasks",
      );
      expect(tasks.rows).toEqual([{ total: 601 }]);
      const documents = await db.query(
        "select title,storage_path from public.documents",
      );
      expect(documents.rows).toEqual([
        { title: "مدرک", storage_path: `user/${user}/${doc}/restore.pdf` },
      ]);
      expect(objects.get(`user/${user}/${doc}/restore.pdf`)).toEqual(
        new Uint8Array([1, 2, 3]),
      );
      expect((await restoreMissing(client, zip)).inserted).toBe(0);
      const restoredPath = `user/${user}/${doc}/restore.pdf`;
      await db.query("delete from storage.objects where name=$1", [
        restoredPath,
      ]);
      objects.delete(restoredPath);
      const repaired = await restoreMissing(client, zip);
      expect(repaired.inserted).toBe(0);
      expect(repaired.repairedFiles).toBe(1);
      expect(objects.get(restoredPath)).toEqual(new Uint8Array([1, 2, 3]));
    } finally {
      await db.close();
    }
  }, 60000);
});
