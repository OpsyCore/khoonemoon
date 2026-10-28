import { NextResponse } from "next/server";
import { pushSubscriptionSchema } from "@/features/reminders/push";
import {
  getSessionContext,
  serverError,
  validationError,
} from "@/lib/api/session";

export async function GET() {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, user_agent, created_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) return serverError("دریافت دستگاه‌های ثبت‌شده ناموفق بود.");

  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;

  const parsed = pushSubscriptionSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        revoked_at: null,
      },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();

  if (error || !data) return serverError("ثبت دستگاه برای اعلان ناموفق بود.");

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase, userId } = session.context;
  const endpoint = new URL(request.url).searchParams.get("endpoint");

  let query = supabase
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (endpoint) {
    query = query.eq("endpoint", endpoint);
  }

  const { error } = await query;

  if (error) return serverError("لغو اعلان این دستگاه ناموفق بود.");

  return NextResponse.json({ ok: true });
}
