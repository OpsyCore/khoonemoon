import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { exportMobileBackup } from "@/features/export/direct-client";
import { restoreMissing } from "@/features/export/restore-client";

Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});

const sanitize = (sql: string) =>
  sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\.*$/gm, "");

const owner = "10000000-0000-4000-8000-000000000001";
const member = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000003";
const houseA = "20000000-0000-4000-8000-00000000000a";
const houseB = "20000000-0000-4000-8000-00000000000b";
const docId = "30000000-0000-4000-8000-000000000001";
const appId = "40000000-0000-4000-8000-000000000001";

describe("home management PGlite RLS, delivery authorization and v3 backup", () => {
  it("isolates households, revokes departed-member reminder delivery, protects legacy v1 clients, and restores v3 backups", async () => {
    const db = await PGlite.create();
    try {
      const migrations = readdirSync("drizzle")
        .filter((f) => f.endsWith(".sql"))
        .sort();
      await db.exec(
        sanitize(readFileSync("db/local/00_auth_shim.sql", "utf8")),
      );
      for (const f of migrations)
        await db.exec(sanitize(readFileSync(`drizzle/${f}`, "utf8")));
      for (const f of migrations)
        await db.exec(sanitize(readFileSync(`drizzle/${f}`, "utf8")));

      await db.exec(`
        insert into auth.users(id,email,encrypted_password) values
          ('${owner}','owner@example.invalid','pw-owner'),
          ('${member}','member@example.invalid','pw-member'),
          ('${outsider}','outsider@example.invalid','pw-out');
        insert into public.households(id,name,created_by) values
          ('${houseA}','خانه الف','${owner}'),
          ('${houseB}','خانه ب','${outsider}');
        insert into public.household_members(household_id,user_id,role) values
          ('${houseA}','${owner}','OWNER'),
          ('${houseA}','${member}','MEMBER'),
          ('${houseB}','${outsider}','OWNER');
      `);

      const asUser = async (uid: string) => {
        await db.exec("reset role");
        await db.query(
          "select set_config('request.jwt.claims',$1,false), set_config('app.reminder_schema_version','',false)",
          [JSON.stringify({ sub: uid, role: "authenticated" })],
        );
        await db.exec("set role authenticated");
      };

      await asUser(owner);
      const storagePath = `user/${owner}/${docId}/warranty.pdf`;
      await db.exec(`
        insert into storage.objects(bucket_id,name) values ('documents','${storagePath}');
        insert into public.documents(id,created_by,title,mime_type,file_size,storage_path,visibility,category,issued_at,expires_at,issuer,renewal_required)
        values ('${docId}','${owner}','گارانتی پکیج','application/pdf',4,'${storagePath}','PRIVATE','WARRANTY','2025-01-01','2026-12-01','بوتان',true);

        insert into public.events(id,title,creator_id,owner_id,household_id,visibility,start_at,end_at,all_day,occasion_type,recurrence_calendar,jalali_month,jalali_day,gift_idea)
        values ('50000000-0000-4000-8000-000000000001','سالگرد خانه','${owner}','${owner}','${houseA}','HOUSEHOLD_SHARED','2026-03-20T00:00:00Z','2026-03-21T00:00:00Z',true,'ANNIVERSARY','JALALI_YEARLY',12,30,'گلدان');

        insert into public.home_appliances(id,household_id,owner_id,created_by,visibility,name,appliance_group,brand,service_interval_days,assignee_id)
        values ('${appId}','${houseA}','${owner}','${owner}','HOUSEHOLD_SHARED','پکیج مرکزی','SYSTEM','بوتان',180,'${member}');
      `);

      // Cleaning task + completion resets checklist items on successor
      const cleanRes = await db.query<{ id: string }>(
        `select public.mobile_create_task($1::jsonb) as id`,
        [
          JSON.stringify({
            title: "نظافت حمام",
            visibility: "HOUSEHOLD_SHARED",
            priority: "NORMAL",
            dueAt: "2027-01-10T09:00:00Z",
            taskKind: "CLEANING",
            cleaningZone: "BATHROOM",
            cleaningChecklist: [{ id: "k1", title: "شستن کاشی", done: true }],
            assigneeIds: [member],
            recurrence: { frequency: "INTERVAL_DAYS", intervalDays: 14 },
            recurrenceTimezone: "Asia/Tehran",
          }),
        ],
      );
      const cleanId = cleanRes.rows[0]!.id;
      const succRes = await db.query<{ id: string }>(
        "select public.mobile_complete_task($1) as id",
        [cleanId],
      );
      const succChecklist = await db.query<{
        cleaning_checklist: { done: boolean }[];
      }>("select cleaning_checklist from public.tasks where id=$1", [
        succRes.rows[0]!.id,
      ]);
      expect(succChecklist.rows[0]!.cleaning_checklist[0]!.done).toBe(false);

      // Member schedules an APPLIANCE reminder; losing membership revokes delivery eligibility
      await asUser(member);
      await db.query("select public.mobile_create_reminders_v2($1::jsonb)", [
        JSON.stringify([
          {
            target_type: "APPLIANCE",
            target_id: appId,
            household_id: houseA,
            remind_at: new Date(Date.now() + 3600_000).toISOString(),
          },
        ]),
      ]);
      expect(
        (
          await db.query<{ v: unknown[] }>(
            "select public.mobile_authorized_reminder_schedule() as v",
          )
        ).rows[0]!.v,
      ).toHaveLength(1);

      // Legacy v1 direct SELECT does NOT expose APPLIANCE target_type
      await asUser(member);
      expect(
        (await db.query("select id from public.reminders")).rows,
      ).toHaveLength(0);

      // Member leaves houseA -> authorized schedule drops to 0
      await db.exec("reset role");
      await db.query(
        "update public.household_members set left_at=now() where household_id=$1 and user_id=$2",
        [houseA, member],
      );
      await asUser(member);
      expect(
        (
          await db.query<{ v: unknown[] }>(
            "select public.mobile_authorized_reminder_schedule() as v",
          )
        ).rows[0]!.v,
      ).toHaveLength(0);

      // Outsider in houseB cannot see houseA appliances or attach across households
      await asUser(outsider);
      expect(
        (await db.query("select id from public.home_appliances")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query<{ compatible: boolean }>(
            "select public.document_entity_household_compatible($1,$2,$3) as compatible",
            [houseA, "APPLIANCE", appId],
          )
        ).rows[0]!.compatible,
      ).toBe(false);

      // Owner renews document, records private appliance & maintenance, exports v3 ZIP, deletes, and restores
      await asUser(owner);
      await db.query(
        "select public.renew_document($1,'2028-12-01','تمدید دوساله',null,'60000000-0000-4000-8000-000000000001')",
        [docId],
      );
      const privAppId = "40000000-0000-4000-8000-000000000002";
      await db.exec(`
        insert into public.home_appliances(id,household_id,owner_id,created_by,visibility,name,appliance_group,brand,service_interval_days)
        values ('${privAppId}',null,'${owner}','${owner}','PRIVATE','تصفیه آب','APPLIANCE','سافت‌واتر',90);
      `);
      await db.query("select public.record_appliance_maintenance($1::jsonb)", [
        JSON.stringify({
          requestId: "60000000-0000-4000-8000-000000000002",
          applianceId: privAppId,
          kind: "SERVICE",
          title: "تعویض فیلتر مرحله اول",
          performedOn: "2026-10-28",
          costAmount: 500000,
          recordInFinance: true,
          documentId: docId,
          reminderOffsetsMinutes: [1440],
        }),
      ]);

      const objects = new Map<string, Uint8Array>([
        [storagePath, new Uint8Array([1, 2, 3, 4])],
      ]);
      const client = {
        auth: {
          getUser: async () => ({ data: { user: { id: owner } }, error: null }),
        },
        storage: {
          from: () => ({
            download: async (p: string) => ({
              data: objects.has(p)
                ? new Blob([new Uint8Array(objects.get(p)!)])
                : null,
              error: objects.has(p) ? null : { message: "missing" },
            }),
            upload: async (p: string, blob: Blob) => {
              if (objects.has(p)) return { error: { message: "exists" } };
              objects.set(p, new Uint8Array(await blob.arrayBuffer()));
              await db.query(
                "insert into storage.objects(bucket_id,name) values ('documents',$1)",
                [p],
              );
              return { error: null };
            },
          }),
        },
        rpc: async (name: string, args?: Record<string, unknown>) => {
          try {
            let res;
            if (name === "mobile_signed_export_snapshot_v3")
              res = await db.query(
                "select public.mobile_signed_export_snapshot_v3() as v",
              );
            else if (name === "mobile_export_snapshot")
              res = await db.query(
                "select public.mobile_export_snapshot() as v",
              );
            else if (name === "mobile_verify_snapshot_signature")
              res = await db.query(
                "select public.mobile_verify_snapshot_signature($1::jsonb,$2) as v",
                [JSON.stringify(args?.p_payload), args?.p_signature],
              );
            else if (name === "document_cleanup_is_retired")
              res = await db.query(
                "select public.document_cleanup_is_retired($1) as v",
                [args?.p_path],
              );
            else if (name === "mobile_restore_signed_shared")
              res = await db.query(
                "select public.mobile_restore_signed_shared($1::jsonb,$2,$3::uuid,$4) as v",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source,
                  args?.p_phase,
                ],
              );
            else if (name === "mobile_restore_missing")
              res = await db.query(
                "select public.mobile_restore_missing($1::jsonb) as v",
                [JSON.stringify(args?.p_tables)],
              );
            else if (name === "mobile_restore_signed_history")
              res = await db.query(
                "select public.mobile_restore_signed_history($1::jsonb,$2) as v",
                [JSON.stringify(args?.p_payload), args?.p_signature],
              );
            else if (name === "mobile_restore_signed_meals")
              res = await db.query(
                "select public.mobile_restore_signed_meals($1::jsonb,$2,$3::uuid) as v",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source,
                ],
              );
            else if (name === "mobile_restore_signed_home_v3")
              res = await db.query(
                "select public.mobile_restore_signed_home_v3($1::jsonb,$2,$3::uuid) as v",
                [
                  JSON.stringify(args?.p_payload),
                  args?.p_signature,
                  args?.p_source ?? null,
                ],
              );
            else throw new Error(`unexpected rpc ${name}`);
            return { data: (res.rows[0] as { v: unknown }).v, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      } as unknown as SupabaseClient;

      const zip = await exportMobileBackup(
        client,
        new Date("2026-10-28T12:00:00Z"),
      );
      await db.exec("reset role");
      await db.exec(`
        delete from public.reminders where user_id='${owner}';
        delete from public.appliance_maintenance_logs;
        delete from public.home_appliances;
        delete from public.document_renewals;
      `);
      await asUser(owner);

      const restored = await restoreMissing(client, zip);
      expect(restored.inserted).toBeGreaterThanOrEqual(4);
      expect(
        (await db.query("select id from public.home_appliances")).rows,
      ).toHaveLength(2);
      expect(
        (await db.query("select id from public.appliance_maintenance_logs"))
          .rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select id from public.document_renewals")).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query<{ v: unknown[] }>(
            "select public.mobile_list_reminders_v2() as v",
          )
        ).rows[0]!.v.length,
      ).toBeGreaterThanOrEqual(1);
    } finally {
      await db.close();
    }
  }, 30000);
});
