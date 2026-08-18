import { NextResponse } from "next/server";
import {
  createHouseholdSchema,
  updateHouseholdSchema,
  type CreateHouseholdInput,
  type UpdateHouseholdInput,
} from "@/features/households/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapRpcError(message: string) {
  if (message.includes("ALREADY_IN_HOUSEHOLD")) {
    return "شما در حال حاضر عضو یک خانه هستید.";
  }
  return "انجام عملیات ممکن نشد.";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json(
      { message: "خطا در دریافت عضویت خانه" },
      { status: 500 },
    );
  }

  if (!membership) {
    return NextResponse.json({ household: null, members: [], invitations: [] });
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, created_by, created_at, updated_at")
    .eq("id", membership.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { message: "خطا در دریافت اطلاعات خانه" },
      { status: 500 },
    );
  }

  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("id, user_id, role, joined_at, left_at, profiles(full_name)")
    .eq("household_id", membership.household_id)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return NextResponse.json(
      { message: "خطا در دریافت اعضا" },
      { status: 500 },
    );
  }

  const { data: invitations, error: invitationsError } = await supabase
    .from("household_invitations")
    .select("id, status, expires_at, created_at")
    .eq("household_id", membership.household_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (invitationsError) {
    return NextResponse.json(
      { message: "خطا در دریافت دعوت‌ها" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    household,
    role: membership.role,
    members,
    invitations,
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateHouseholdInput;
  const parsed = createHouseholdSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
  });

  if (error) {
    return NextResponse.json(
      { message: mapRpcError(error.message) },
      { status: 400 },
    );
  }

  return NextResponse.json({ householdId: data });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UpdateHouseholdInput;
  const parsed = updateHouseholdSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { message: "شما عضو هیچ خانه‌ای نیستید." },
      { status: 400 },
    );
  }

  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { message: "فقط مالک می‌تواند نام خانه را تغییر دهد." },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("households")
    .update({ name: parsed.data.name })
    .eq("id", membership.household_id);

  if (error) {
    return NextResponse.json(
      { message: "بروزرسانی نام خانه انجام نشد." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
