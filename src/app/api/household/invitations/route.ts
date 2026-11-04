import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The bearer code is generated and retained on the device, not on the server. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.codeHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(body.codeHash) ||
    typeof body.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(body.expiresAt))
  ) {
    return NextResponse.json(
      { message: "درخواست دعوت معتبر نیست." },
      { status: 400 },
    );
  }
  const { data, error } = await supabase.rpc(
    "create_household_invitation_retry",
    {
      p_code_hash: body.codeHash,
      p_expires_at: body.expiresAt,
    },
  );
  if (error || !data)
    return NextResponse.json(
      { message: "ایجاد دعوت‌نامه تأیید نشد." },
      { status: 400 },
    );
  return NextResponse.json(
    { status: data.status, expiresAt: data.expires_at },
    { headers: { "Cache-Control": "no-store" } },
  );
}
