import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const clean = (sql: string) =>
  sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\.*$/gm, "");
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const taskA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  taskB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

describe("reminder target integrity on isolated PostgreSQL", () => {
  it("rejects forged home and retargeting, keeps cancellation of orphan reminders, and supports replay", async () => {
    const db = await PGlite.create();
    try {
      await db.exec(clean(readFileSync("db/local/00_auth_shim.sql", "utf8")));
      const migrations = readdirSync("drizzle")
        .filter((x) => x.endsWith(".sql"))
        .sort();
      for (const x of migrations)
        await db.exec(clean(readFileSync(`drizzle/${x}`, "utf8")));
      await db.exec(
        clean(
          readFileSync("drizzle/0059_reminder_target_integrity.sql", "utf8"),
        ),
      );
      await db.exec(`insert into auth.users(id,email) values ('${a}','a@example.test'),('${b}','b@example.test');
      insert into public.tasks(id,title,creator_id,owner_id,visibility) values ('${taskA}','private a','${a}','${a}','PRIVATE'),('${taskB}','private b','${b}','${b}','PRIVATE');
      select set_config('request.jwt.claims','{"sub":"${a}","role":"authenticated"}',false); set role authenticated;`);
      await expect(
        db.query(
          "insert into public.reminders(target_type,target_id,user_id,household_id,remind_at) values ('TASK',$1,$2,$3,now())",
          [taskA, a, b],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into public.reminders(target_type,target_id,user_id,remind_at) values ('TASK',$1,$2,now())",
          [taskB, a],
        ),
      ).rejects.toThrow();
      const home = (
        await db.query("select public.create_household('test') as id")
      ).rows[0] as { id: string };
      const event = (
        await db.query(
          "insert into public.events(title,creator_id,owner_id,household_id,visibility,start_at,end_at) values ('event',$1,$1,$2,'HOUSEHOLD_SHARED',now(),now()+interval '1 hour') returning id",
          [a, home.id],
        )
      ).rows[0] as { id: string };
      await expect(
        db.query(
          "insert into public.reminders(target_type,target_id,user_id,remind_at) values ('EVENT',$1,$2,now())",
          [event.id, a],
        ),
      ).rejects.toThrow();
      await db.query(
        "insert into public.reminders(target_type,target_id,user_id,household_id,remind_at) values ('EVENT',$1,$2,$3,now())",
        [event.id, a, home.id],
      );
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: b, role: "authenticated" }),
      ]);
      await expect(
        db.query(
          "insert into public.reminders(target_type,target_id,user_id,household_id,remind_at) values ('EVENT',$1,$2,$3,now())",
          [event.id, b, home.id],
        ),
      ).rejects.toThrow();
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: a, role: "authenticated" }),
      ]);
      const result = await db.query(
        "insert into public.reminders(target_type,target_id,user_id,remind_at) values ('TASK',$1,$2,now()) returning id",
        [taskA, a],
      );
      const id = (result.rows[0] as { id: string }).id;
      await expect(
        db.query("update public.reminders set target_id=$1 where id=$2", [
          taskB,
          id,
        ]),
      ).rejects.toThrow("REMINDER_IDENTITY_IMMUTABLE");
      await expect(
        db.query("update public.reminders set household_id=$1 where id=$2", [
          b,
          id,
        ]),
      ).rejects.toThrow("REMINDER_IDENTITY_IMMUTABLE");
      await db.query("delete from public.tasks where id=$1", [taskA]);
      const cancelled = await db.query(
        "update public.reminders set status='CANCELED' where id=$1 returning status",
        [id],
      );
      expect(cancelled.rows).toEqual([{ status: "CANCELED" }]);
    } finally {
      await db.close();
    }
  }, 60000);
});
