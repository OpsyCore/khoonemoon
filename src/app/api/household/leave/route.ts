import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapLeaveError(message: string) {
  if (message.includes("NOT_IN_HOUSEHOLD"))
    return "شما عضو هیچ خانه‌ای نیستید.";
  if (message.includes("OWNER_CANNOT_LEAVE_WITH_ACTIVE_MEMBERS")) {
    return "تا زمانی که عضو فعال دیگری وجود دارد، مالک نمی‌تواند خانه را ترک کند.";
  }
  return "ترک خانه انجام نشد.";
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.rpc("leave_current_household");

  if (error) {
    return NextResponse.json(
      { message: mapLeaveError(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
