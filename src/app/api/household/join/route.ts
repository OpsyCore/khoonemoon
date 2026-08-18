import { NextResponse } from "next/server";
import { hashInvitationCode } from "@/features/households/invitation-code";
import { joinHouseholdSchema } from "@/features/households/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapJoinError(message: string) {
  if (message.includes("INVITATION_NOT_FOUND")) return "دعوت‌نامه یافت نشد.";
  if (message.includes("INVITATION_EXPIRED")) return "دعوت‌نامه منقضی شده است.";
  if (message.includes("INVITATION_NOT_PENDING"))
    return "این دعوت‌نامه دیگر قابل استفاده نیست.";
  if (message.includes("ALREADY_IN_HOUSEHOLD"))
    return "شما هم‌اکنون عضو یک خانه هستید.";
  return "عضویت در خانه انجام نشد.";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = joinHouseholdSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const codeHash = hashInvitationCode(parsed.data.code);
  const { data, error } = await supabase.rpc("join_household_with_invitation", {
    p_code_hash: codeHash,
  });

  if (error) {
    return NextResponse.json(
      { message: mapJoinError(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ householdId: data });
}
