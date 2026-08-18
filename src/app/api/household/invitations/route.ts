import { NextResponse } from "next/server";
import {
  generateInvitationCode,
  hashInvitationCode,
} from "@/features/households/invitation-code";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapInviteError(message: string) {
  if (message.includes("ONLY_OWNER_CAN_INVITE")) {
    return "فقط مالک خانه می‌تواند دعوت‌نامه ایجاد کند.";
  }
  return "ایجاد دعوت‌نامه انجام نشد.";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const expiresInHours =
    typeof body.expiresInHours === "number" && body.expiresInHours > 0
      ? Math.min(body.expiresInHours, 168)
      : 72;

  const code = generateInvitationCode();
  const codeHash = hashInvitationCode(code);
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase.rpc("create_household_invitation", {
    p_code_hash: codeHash,
    p_expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json(
      { message: mapInviteError(error.message) },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/home?inviteCode=${encodeURIComponent(code)}`;

  return NextResponse.json({
    invitation: {
      id: data.id,
      status: data.status,
      expires_at: data.expires_at,
      created_at: data.created_at,
    },
    code,
    inviteUrl,
  });
}
