import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapCancelError(message: string) {
  if (message.includes("ONLY_OWNER_CAN_CANCEL_INVITE")) {
    return "فقط مالک خانه می‌تواند دعوت‌نامه را لغو کند.";
  }
  return "لغو دعوت‌نامه انجام نشد.";
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.rpc("cancel_household_invitation", {
    p_invitation_id: params.id,
  });

  if (error) {
    return NextResponse.json(
      { message: mapCancelError(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
