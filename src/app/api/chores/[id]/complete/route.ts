import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/api/session";

/** The caller must supply the revision it displayed, never fetch a new one on
 * retry: doing so could record the next recurrence after a lost response. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSessionContext();
  if (!session.ok) return session.response;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !Number.isSafeInteger(body.expectedRevision) ||
    body.expectedRevision < 0
  ) {
    return NextResponse.json(
      { message: "نسخهٔ کار مشخص نیست؛ فهرست را تازه کنید." },
      { status: 400 },
    );
  }
  const { data, error } = await session.context.supabase.rpc(
    "complete_chore_expected_version",
    {
      p_chore_id: id,
      p_expected_version: body.expectedRevision,
    },
  );
  if (error || !data)
    return NextResponse.json(
      {
        message:
          "نتیجهٔ ثبت انجام مشخص نیست یا کار تغییر کرده؛ فهرست را تازه کنید.",
      },
      { status: 409 },
    );
  return NextResponse.json({ ok: true, completionId: data });
}
