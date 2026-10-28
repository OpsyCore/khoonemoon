import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/api/session";

const ERROR_MESSAGES: Record<string, string> = {
  CHORE_NOT_FOUND: "کار خانه پیدا نشد.",
  NOT_HOUSEHOLD_MEMBER: "شما عضو این خانه نیستید.",
  NOT_AUTHENTICATED: "برای ثبت انجام کار باید وارد حساب شوید.",
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;

  const { supabase } = session.context;

  const { data, error } = await supabase.rpc("complete_chore", {
    p_chore_id: id,
  });

  if (error) {
    const friendly =
      Object.entries(ERROR_MESSAGES).find(([code]) =>
        error.message.includes(code),
      )?.[1] ?? "ثبت انجام کار خانه ناموفق بود.";

    return NextResponse.json({ message: friendly }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    ok: true,
    completionId: row?.completion_id ?? null,
    nextDueAt: row?.next_due_at ?? null,
    nextAssigneeId: row?.next_assignee_id ?? null,
  });
}
