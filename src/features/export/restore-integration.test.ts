import { describe, it, expect } from "vitest";
import { createHash, createHmac, webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { buildChecksums } from "./backup-integrity";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportMobileBackup } from "./direct-client";
import { restoreMissing } from "./restore-client";
import {
  makeMemberDocumentBundle,
  restoreOwnSharedDocuments,
} from "./member-documents";
import { readBackup } from "./backup-integrity";
import { encryptBackup, decryptBackup } from "./backup-encryption";
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
      // Match CI: replay all migrations; in particular, never rotate the key.
      const before = (
        await db.query("select secret from backup_private.signing_key")
      ).rows[0];
      for (const file of readdirSync("drizzle")
        .filter((x) => x.endsWith(".sql"))
        .sort())
        await db.exec(sanitize(readFileSync(`drizzle/${file}`, "utf8")));
      expect(
        (await db.query("select secret from backup_private.signing_key"))
          .rows[0],
      ).toEqual(before);
      await db.exec(`insert into auth.users(id,email) values ('${user}','restore@example.com');
     select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',false); set role authenticated;
     insert into public.tasks(title,creator_id,owner_id,visibility,priority) values ('بازگشت کار','${user}','${user}','PRIVATE','NORMAL');
     insert into public.tasks(title,creator_id,owner_id,visibility,priority) select 'کار اضافی '||g,'${user}','${user}','PRIVATE','NORMAL' from generate_series(1,600) g;
     insert into public.tasks(id,title,creator_id,owner_id,visibility,status,priority) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','پیشین','${user}','${user}','PRIVATE','COMPLETED','NORMAL'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','بعدی','${user}','${user}','PRIVATE','PENDING','NORMAL');
     reset role;
     insert into public.task_recurrence_instances(completed_task_id,next_task_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
     set role authenticated;
     insert into public.financial_records(owner_id,created_by,visibility,record_type,title,amount) values ('${user}','${user}','PRIVATE','EXPENSE','decimal',12.00), ('${user}','${user}','PRIVATE','EXPENSE','large decimal',100000000000.12);
     insert into storage.objects(bucket_id,name) values ('documents','${original}');
     insert into public.documents(id,created_by,title,mime_type,file_size,storage_path,visibility) values ('${doc}','${user}','مدرک','application/pdf',3,'${original}','PRIVATE');`);
      // Compare the DB implementation to Node's standard HMAC, using only an
      // ephemeral key from this isolated database (never production secrets).
      await db.exec("reset role");
      const localKey = await db.query(
        "select secret from backup_private.signing_key",
      );
      const dbMac = await db.query(
        "select backup_private.sign_payload('local test vector') as mac",
      );
      const key = (localKey.rows[0] as { secret: string }).secret;
      const expectedMac = createHmac(
        "sha256",
        createHash("sha256").update(key).digest(),
      )
        .update("local test vector")
        .digest("hex");
      expect(dbMac.rows).toEqual([{ mac: expectedMac }]);
      await db.exec("set role authenticated");
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
      let actingUser = user;
      const client = {
        auth: {
          getUser: async () => ({
            data: { user: { id: actingUser } },
            error: null,
          }),
        },
        storage: { from: () => bucket },
        rpc: async (
          name: string,
          args?: {
            p_tables?: unknown;
            p_payload?: unknown;
            p_signature?: string;
            p_source?: string;
            p_phase?: string;
          },
        ) => {
          try {
            let result;
            if (name === "document_cleanup_is_retired")
              result = await db.query(
                "select public.document_cleanup_is_retired($1) as value",
                [(args as { p_path?: string })?.p_path],
              );
            else if (name === "mobile_export_snapshot")
              result = await db.query(
                "select public.mobile_export_snapshot() as value",
              );
            else if (name === "mobile_export_snapshot_v2")
              result = await db.query(
                "select public.mobile_export_snapshot_v2() as value",
              );
            else if (name === "mobile_signed_export_snapshot_v2")
              result = await db.query(
                "select public.mobile_signed_export_snapshot_v2() as value",
              );
            else if (name === "mobile_export_snapshot_v3")
              result = await db.query(
                "select public.mobile_export_snapshot_v3() as value",
              );
            else if (name === "mobile_signed_export_snapshot_v3")
              result = await db.query(
                "select public.mobile_signed_export_snapshot_v3() as value",
              );
            else if (name === "mobile_restore_signed_home_v3")
              result = await db.query(
                "select public.mobile_restore_signed_home_v3($1::jsonb,$2,$3::uuid) as value",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source ?? null,
                ],
              );
            else if (name === "mobile_restore_signed_meals")
              result = await db.query(
                "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid) as value",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source,
                ],
              );
            else if (name === "mobile_verify_snapshot_signature")
              result = await db.query(
                "select public.mobile_verify_snapshot_signature($1::jsonb,$2) as value",
                [JSON.stringify(args?.p_payload), args?.p_signature],
              );
            else if (name === "mobile_restore_signed_shared")
              result = await db.query(
                "select public.mobile_restore_signed_shared($1::jsonb,$2,$3::uuid,$4) as value",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source,
                  args?.p_phase,
                ],
              );
            else if (name === "mobile_recover_household_copy")
              result = await db.query(
                "select public.mobile_recover_household_copy($1::jsonb,$2,$3::uuid) as value",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source,
                ],
              );
            else if (name === "mobile_restore_signed_history")
              result = await db.query(
                "select public.mobile_restore_signed_history($1::jsonb,$2) as value",
                [JSON.stringify(args?.p_payload), args?.p_signature],
              );
            else
              result = await db.query(
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
      // A real legacy 19-table signed archive remains readable and restorable.
      const oldSnapshot = (
        await db.query("select public.mobile_signed_export_snapshot() as value")
      ).rows[0] as {
        value: {
          payload: {
            account_id: string;
            snapshot: {
              exported_at: string;
              tables: Record<string, unknown[]>;
              counts: Record<string, number>;
            };
          };
          signature: string;
        };
      };
      const oldFiles = unzipSync(zip);
      const oldArchive = JSON.parse(strFromU8(oldFiles["archive.json"]));
      oldArchive.tables = oldSnapshot.value.payload.snapshot.tables;
      oldArchive.counts = oldSnapshot.value.payload.snapshot.counts;
      oldArchive.snapshot_at = oldSnapshot.value.payload.snapshot.exported_at;
      const paths: Record<string, string> = {};
      oldArchive.tables.documents = (
        oldArchive.tables.documents as Record<string, unknown>[]
      ).map((row) => {
        paths[row.id as string] = row.storage_path as string;
        const { storage_path: _path, ...rest } = row;
        void _path;
        return { ...rest, archive_file: `documents/${row.id}.pdf` };
      });
      oldArchive.signed_snapshot = {
        version: 1,
        account_id: oldSnapshot.value.payload.account_id,
        signature: oldSnapshot.value.signature,
        paths,
      };
      oldFiles["archive.json"] = strToU8(JSON.stringify(oldArchive));
      delete oldFiles["checksums.json"];
      oldFiles["checksums.json"] = new Uint8Array(
        await buildChecksums(oldFiles),
      );
      const legacyZip = zipSync(oldFiles, { level: 0 });
      expect(Object.keys((await readBackup(legacyZip)).tables)).toHaveLength(
        19,
      );
      // A modified archive with a recomputed checksum must still fail the
      // server signature, before any file or row is touched.
      const altered = unzipSync(zip);
      const archive = JSON.parse(strFromU8(altered["archive.json"]));
      archive.tables.tasks[0].title = "forged";
      altered["archive.json"] = strToU8(JSON.stringify(archive));
      delete altered["checksums.json"];
      altered["checksums.json"] = new Uint8Array(await buildChecksums(altered));
      await expect(
        restoreMissing(client, zipSync(altered, { level: 0 })),
      ).rejects.toThrow("اصالت اطلاعات");
      await db.exec(
        `delete from public.tasks; delete from public.documents where id='${doc}'; delete from storage.objects where name='${original}';`,
      );
      objects.delete(original);
      await db.exec("reset role");
      await db.query("delete from public.profiles where id=$1", [user]);
      await db.exec("set role authenticated");
      const result = await restoreMissing(client, zip);
      expect(result.inserted).toBe(606);
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.profiles where id=$1",
            [user],
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
      const tasks = await db.query(
        "select count(*)::int as total from public.tasks",
      );
      expect(tasks.rows).toEqual([{ total: 603 }]);
      expect(
        (
          await db.query(
            "select count(*)::int as total from public.task_recurrence_instances",
          )
        ).rows,
      ).toEqual([{ total: 1 }]);
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
      expect((await restoreMissing(client, legacyZip)).inserted).toBe(0);
      const restoredPath = `user/${user}/${doc}/restore.pdf`;
      await db.query("delete from storage.objects where name=$1", [
        restoredPath,
      ]);
      objects.delete(restoredPath);
      const repaired = await restoreMissing(client, zip);
      expect(repaired.inserted).toBe(0);
      expect(repaired.repairedFiles).toBe(1);
      expect(objects.get(restoredPath)).toEqual(new Uint8Array([1, 2, 3]));
      const oldHome = (
        (await db.query("select public.create_household('خانهٔ آزمون') as id"))
          .rows[0] as { id: string }
      ).id;
      const transferList = (
        await db.query(
          "insert into public.shopping_lists(household_id,name,created_by) values ($1,'meal list',$2) returning id",
          [oldHome, user],
        )
      ).rows[0] as { id: string };
      const transfer = await db.query(
        "select public.mobile_add_meal_ingredients($1::uuid,$2::text[]) as result",
        [transferList.id, ["bread", "rice", "bread"]],
      );
      expect(transfer.rows[0]).toEqual({ result: { inserted: 2, skipped: 0 } });
      const transferRetry = await db.query(
        "select public.mobile_add_meal_ingredients($1::uuid,$2::text[]) as result",
        [transferList.id, ["bread", "rice"]],
      );
      expect(transferRetry.rows[0]).toEqual({
        result: { inserted: 0, skipped: 2 },
      });
      await db.exec("reset role");
      const outsider = "dddddddd-dddd-4ddd-8ddd-ddddddddddde";
      await db.query(
        "insert into auth.users(id,email) values ($1,'outsider@example.com')",
        [outsider],
      );
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: outsider, role: "authenticated" }),
      ]);
      await db.exec("set role authenticated");
      await expect(
        db.query(
          "select public.mobile_add_meal_ingredients($1::uuid,$2::text[])",
          [transferList.id, ["unauthorized"]],
        ),
      ).rejects.toThrow("LIST_NOT_AVAILABLE");
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: user, role: "authenticated" }),
      ]);
      await db.query("delete from public.shopping_lists where id=$1", [
        transferList.id,
      ]);
      const sharedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const sharedPath = `household/${oldHome}/${sharedId}/original.pdf`;
      await db.query(
        "insert into storage.objects(bucket_id,name) values ('documents',$1)",
        [sharedPath],
      );
      objects.set(sharedPath, new Uint8Array([4, 5, 6]));
      await db.query(
        `insert into public.tasks(title,creator_id,owner_id,household_id,visibility,priority) values ('shared task',$1,$1,$2,'HOUSEHOLD_SHARED','NORMAL')`,
        [user, oldHome],
      );
      await db.query(
        `insert into public.documents(id,household_id,created_by,title,mime_type,file_size,storage_path,visibility) values ($1,$2,$3,'shared doc','application/pdf',3,$4,'HOUSEHOLD_SHARED')`,
        [sharedId, oldHome, user, sharedPath],
      );
      const other = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      await db.exec("reset role");
      await db.query(
        "insert into auth.users(id,email) values ($1,'other@example.com')",
        [other],
      );
      await db.query(
        "insert into public.household_members(household_id,user_id,role) values ($1,$2,'MEMBER')",
        [oldHome, other],
      );
      await db.query(
        "insert into public.tasks(title,creator_id,owner_id,household_id,visibility,priority) values ('other task',$1,$1,$2,'HOUSEHOLD_SHARED','NORMAL')",
        [other, oldHome],
      );
      await db.exec("set role authenticated");
      await db.exec("reset role");
      await db.query(
        "insert into public.task_assignees(task_id,assignee_id) select id,$1 from public.tasks where title='other task'",
        [other],
      );
      const otherDoc = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      const otherPath = `household/${oldHome}/${otherDoc}/other.pdf`;
      const otherList = "ffffffff-ffff-4fff-8fff-fffffffffff1";
      await db.query(
        "insert into public.shopping_lists(id,household_id,name,created_by) values ($1,$2,'other list',$3)",
        [otherList, oldHome, other],
      );
      await db.query(
        "insert into public.shopping_items(list_id,name,added_by,quantity) values ($1,'other item',$2,1.250)",
        [otherList, other],
      );
      await db.query(
        "insert into public.financial_records(household_id,owner_id,created_by,visibility,record_type,title,amount) values ($1,$2,$2,'HOUSEHOLD_SHARED','EXPENSE','other finance',23.50)",
        [oldHome, other],
      );
      await db.query(
        "insert into public.events(title,creator_id,owner_id,household_id,visibility,start_at,end_at) values ('other event',$1,$1,$2,'HOUSEHOLD_SHARED',now(),now()+interval '1 hour')",
        [other, oldHome],
      );
      await db.query(
        "insert into public.chores(household_id,title,created_by,rotation_mode,frequency) values ($1,'other chore',$2,'FIXED','NONE')",
        [oldHome, other],
      );
      await db.query(
        "insert into storage.objects(bucket_id,name) values ('documents',$1)",
        [otherPath],
      );
      objects.set(otherPath, new Uint8Array([7, 8, 9]));
      await db.query(
        "insert into public.documents(id,household_id,created_by,title,mime_type,file_size,storage_path,visibility) values ($1,$2,$3,'other doc','application/pdf',3,$4,'HOUSEHOLD_SHARED')",
        [otherDoc, oldHome, other, otherPath],
      );
      await db.query(
        "insert into public.document_attachments(document_id,entity_type,entity_id,created_by) select $1,'TASK',id,$2 from public.tasks where title='other task'",
        [otherDoc, other],
      );
      await db.query(
        "insert into public.meal_plans(id,household_id,created_by,meal_date,meal_type,title,ingredients) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',$1,$2,'2026-01-02','breakfast','owner meal','bread'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',$1,$3,'2026-01-02','lunch','member meal','rice')",
        [oldHome, user, other],
      );
      await db.exec("set role authenticated");
      // A member's signed snapshot cannot restore someone else's authored row,
      // and the same signed payload is unusable by a different account.
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: other, role: "authenticated" }),
      ]);
      const memberSigned = (
        await db.query("select public.mobile_signed_export_snapshot_v2() as v")
      ).rows[0] as { v: { payload: unknown; signature: string } };
      const memberResult = await db.query(
        "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid) as result",
        [
          JSON.stringify(memberSigned.v.payload),
          memberSigned.v.signature,
          oldHome,
        ],
      );
      expect(memberResult.rows[0]).toEqual({
        result: { inserted: 0, skipped: 1, deferred: 1 },
      });
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: user, role: "authenticated" }),
      ]);
      await expect(
        db.query(
          "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid)",
          [
            JSON.stringify(memberSigned.v.payload),
            memberSigned.v.signature,
            oldHome,
          ],
        ),
      ).rejects.toThrow("INVALID_BACKUP_SIGNATURE");
      const otherZip = await exportMobileBackup(
        client,
        new Date("2026-01-02T00:00:00Z"),
      );
      await db.exec("reset role");
      await db.query("delete from public.households where id=$1", [oldHome]);
      await db.exec("set role authenticated");
      await expect(restoreMissing(client, otherZip)).rejects.toThrow(
        "خانهٔ اصلی موجود نیست",
      );
      const recovered = await restoreMissing(client, otherZip, true);
      expect(recovered.householdCopy).toBe(true);
      expect(recovered.inserted).toBe(10);
      expect(recovered.deferred).toBe(4);
      const home = await db.query(
        "select household_id from public.household_members where user_id=$1 and left_at is null",
        [user],
      );
      const newHome = (home.rows[0] as { household_id: string }).household_id;
      expect(newHome).not.toBe(oldHome);
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.meal_plans where household_id=$1",
            [newHome],
          )
        ).rows,
      ).toEqual([{ n: 2 }]);
      const signedMeals = (await readBackup(otherZip)).signedSnapshot!;
      await expect(
        db.query(
          "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid)",
          [JSON.stringify(signedMeals.payload), "0".repeat(64), oldHome],
        ),
      ).rejects.toThrow("INVALID_BACKUP_SIGNATURE");
      // Existing date/type wins over a restored row, and retry cannot overwrite it.
      await db.query("delete from public.meal_plans where title='owner meal'");
      await db.query(
        "insert into public.meal_plans(household_id,created_by,meal_date,meal_type,title) values ($1,$2,'2026-01-02','breakfast','newer meal')",
        [newHome, user],
      );
      const collision = await db.query(
        "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid) as result",
        [JSON.stringify(signedMeals.payload), signedMeals.signature, oldHome],
      );
      expect(collision.rows[0]).toEqual({
        result: { inserted: 0, skipped: 2, deferred: 0 },
      });
      expect(
        (
          await db.query(
            "select title from public.meal_plans where meal_type='breakfast'",
          )
        ).rows,
      ).toEqual([{ title: "newer meal" }]);
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.household_members where household_id=$1",
            [newHome],
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
      const newPath = `household/${newHome}/${sharedId}/restore.pdf`;
      expect(objects.get(newPath)).toEqual(new Uint8Array([4, 5, 6]));
      expect(
        (
          await db.query(
            "select count(*)::int as n from storage.objects where name=$1",
            [sharedPath],
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
      expect((await restoreMissing(client, otherZip, true)).deferred).toBe(4);
      const beforeJoin = await makeMemberDocumentBundle(
        otherZip,
        other,
        new Date("2026-01-03T00:00:00Z"),
      );
      actingUser = other;
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: other, role: "authenticated" }),
      ]);
      await expect(
        restoreOwnSharedDocuments(client, beforeJoin),
      ).rejects.toThrow("ابتدا دوباره به خانه بپیوندید");
      actingUser = user;
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: user, role: "authenticated" }),
      ]);
      await db.exec("reset role");
      await db.query(
        "insert into public.household_members(household_id,user_id,role) values ($1,$2,'MEMBER')",
        [newHome, other],
      );
      await db.exec("set role authenticated");
      const completed = await restoreMissing(client, otherZip, true);
      expect(completed.deferred).toBe(2);
      expect(completed.inserted).toBe(1);
      const bundle = await makeMemberDocumentBundle(
        otherZip,
        other,
        new Date("2026-01-03T00:00:00Z"),
      );
      const protectedBundle = await encryptBackup(
        bundle,
        "member secret password",
      );
      const openedBundle = await decryptBackup(
        protectedBundle,
        "member secret password",
      );
      expect(openedBundle).toEqual(bundle);
      const bundleContents = await readBackup(openedBundle);
      expect(Object.keys(bundleContents.tables)).toEqual(["documents"]);
      expect(bundleContents.tables.documents).toHaveLength(1);
      expect(new TextDecoder().decode(bundle)).not.toContain("بازگشت کار");
      await expect(restoreOwnSharedDocuments(client, bundle)).rejects.toThrow(
        "حساب شما",
      );
      actingUser = other;
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: other, role: "authenticated" }),
      ]);
      const restored = await restoreOwnSharedDocuments(client, bundle);
      expect(restored.inserted).toBe(1);
      const otherNewPath = `household/${newHome}/${otherDoc}/restore.pdf`;
      expect(objects.get(otherNewPath)).toEqual(new Uint8Array([7, 8, 9]));
      expect((await restoreOwnSharedDocuments(client, bundle)).inserted).toBe(
        0,
      );
      objects.set(otherNewPath, new Uint8Array([9, 9, 9]));
      await restoreOwnSharedDocuments(client, bundle);
      expect(objects.get(otherNewPath)).toEqual(new Uint8Array([9, 9, 9]));
      await db.query("delete from storage.objects where name=$1", [
        otherNewPath,
      ]);
      objects.delete(otherNewPath);
      expect((await restoreOwnSharedDocuments(client, bundle)).repaired).toBe(
        1,
      );
      expect(objects.get(otherNewPath)).toEqual(new Uint8Array([7, 8, 9]));
      actingUser = user;
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: user, role: "authenticated" }),
      ]);
      const final = await restoreMissing(client, otherZip, true);
      expect(final.deferred).toBe(0);
      expect(final.inserted).toBe(1); // original signed attachment restored by owner
      expect((await restoreMissing(client, otherZip, true)).inserted).toBe(0);
    } finally {
      await db.close();
    }
  }, 60000);
});
