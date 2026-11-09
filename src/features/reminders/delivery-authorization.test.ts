import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const sanitize = (sql: string) =>
  sql
    .replace(/create extension[^;]+;/gi, "")
    .replace(/create index[^;]*gin_trgm_ops[^;]*;/gi, "")
    .replace(/^\\.*$/gm, "");
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  device = "33333333-3333-4333-8333-333333333333";
const secret = "a".repeat(64);
describe("delivery authorization", () => {
  it("revokes foreground, device and push eligibility when membership ends", async () => {
    const db = await PGlite.create();
    try {
      await db.exec(
        sanitize(readFileSync("db/local/00_auth_shim.sql", "utf8")),
      );
      for (const file of readdirSync("drizzle")
        .filter((x) => x.endsWith(".sql"))
        .sort())
        await db.exec(sanitize(readFileSync(`drizzle/${file}`, "utf8")));
      await db.exec(
        sanitize(
          readFileSync(
            "drizzle/0060_reminder_delivery_authorization.sql",
            "utf8",
          ),
        ),
      );
      await db.query(
        "insert into auth.users(id,email) values ($1,'owner@example.test'),($2,'member@example.test')",
        [owner, member],
      );
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: owner, role: "authenticated" }),
      ]);
      await db.exec("set role authenticated");
      const home = (
        await db.query("select public.create_household('test') as id")
      ).rows[0] as { id: string };
      const event = (
        await db.query(
          "insert into public.events(title,creator_id,owner_id,household_id,visibility,start_at,end_at) values ('event',$1,$1,$2,'HOUSEHOLD_SHARED',now(),now()+interval '1 hour') returning id",
          [owner, home.id],
        )
      ).rows[0] as { id: string };
      await db.exec("reset role");
      await db.query(
        "insert into public.household_members(household_id,user_id,role) values ($1,$2,'MEMBER')",
        [home.id, member],
      );
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ sub: member, role: "authenticated" }),
      ]);
      await db.exec("set role authenticated");
      await db.query("select public.register_reminder_device($1,$2)", [
        device,
        secret,
      ]);
      const reminder = (
        await db.query(
          "insert into public.reminders(target_type,target_id,user_id,household_id,remind_at) values ('EVENT',$1,$2,$3,now()-interval '1 minute') returning id",
          [event.id, member, home.id],
        )
      ).rows[0] as { id: string };
      expect(
        (
          await db.query(
            "select id from jsonb_to_recordset(public.mobile_authorized_reminder_schedule()) as x(id uuid)",
          )
        ).rows,
      ).toEqual([{ id: reminder.id }]);
      const deviceRead = async () =>
        (
          await db.query("select public.read_reminder_device($1,$2) as data", [
            device,
            secret,
          ])
        ).rows[0] as { data: { reminders: { id: string }[] } };
      expect((await deviceRead()).data.reminders.map((x) => x.id)).toEqual([
        reminder.id,
      ]);
      await db.exec("reset role");
      await db.query("update public.profiles set timezone='UTC' where id=$1", [
        member,
      ]);
      await db.query(
        "insert into public.notification_preferences(user_id,web_push_enabled,quiet_hours_enabled) values ($1,true,false) on conflict(user_id) do update set web_push_enabled=true,quiet_hours_enabled=false",
        [member],
      );
      await db.query(
        "insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ($1,'https://updates.push.services.mozilla.com/wpush/v2/local','aaaaaaaaaaaaaaaaaaaa','aaaaaaaa')",
        [member],
      );
      const job = (
        await db.query(
          "select job_id,token from public.standalone_push_claim(1)",
        )
      ).rows[0] as { job_id: string; token: string };
      expect(job).toBeDefined();
      expect(
        (
          await db.query(
            "select public.standalone_push_validate($1,$2) as valid",
            [job.job_id, job.token],
          )
        ).rows,
      ).toEqual([{ valid: true }]);
      await db.query(
        "update public.household_members set left_at=now() where household_id=$1 and user_id=$2",
        [home.id, member],
      );
      expect(
        (
          await db.query(
            "select public.standalone_push_validate($1,$2) as valid",
            [job.job_id, job.token],
          )
        ).rows,
      ).toEqual([{ valid: false }]);
      await db.exec("set role authenticated");
      expect(
        (
          await db.query(
            "select id from jsonb_to_recordset(public.mobile_authorized_reminder_schedule()) as x(id uuid)",
          )
        ).rows,
      ).toEqual([]);
      expect((await deviceRead()).data.reminders).toEqual([]);
      expect(
        (
          await db.query("select id from public.reminders where id=$1", [
            reminder.id,
          ])
        ).rows,
      ).toEqual([{ id: reminder.id }]);
      const version = (
        await db.query("select updated_at from public.reminders where id=$1", [
          reminder.id,
        ])
      ).rows[0] as { updated_at: Date };
      const claim = () =>
        db.query(
          "select public.claim_own_authorized_reminder($1,'PENDING',$2) as claimed",
          [reminder.id, version.updated_at],
        );
      expect((await claim()).rows).toEqual([{ claimed: false }]);
      await expect(
        db.query(
          "select public.claim_service_authorized_reminder($1,$2,'PENDING',$3)",
          [reminder.id, member, version.updated_at],
        ),
      ).rejects.toThrow();
      await db.exec("reset role");
      await db.query(
        "update public.household_members set left_at=null where household_id=$1 and user_id=$2",
        [home.id, member],
      );
      await db.exec("set role authenticated");
      expect((await claim()).rows).toEqual([{ claimed: true }]);
      expect((await claim()).rows).toEqual([{ claimed: false }]);
      await expect(
        db.query(
          "select backup_private.reminder_target_authorized($1,'EVENT',$2,$3)",
          [member, event.id, home.id],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 60000);
});
