import { NextResponse } from "next/server";
import { createFinanceRecordSchema } from "@/features/finance/schemas";
import {
  financeErrorStatus,
  getCurrentFinanceMembership,
  mapFinanceError,
  sortFinanceRecords,
  toCreateFinanceRpcArgs,
  validateCreateFinanceForUser,
} from "@/features/finance/server";
import {
  FINANCE_RECORD_SELECT,
  type FinanceRecord,
} from "@/features/finance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const membership = await getCurrentFinanceMembership(user.id);
    const householdId = membership?.household_id ?? null;

    const recordsResult = await supabase
      .from("finance_records")
      .select(FINANCE_RECORD_SELECT);

    if (recordsResult.error) {
      return NextResponse.json(
        { message: "دریافت موارد مالی ناموفق بود." },
        { status: 500 },
      );
    }

    let members: { user_id: string; full_name: string }[] = [
      { user_id: user.id, full_name: "من" },
    ];

    if (householdId) {
      const membersResult = await supabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .is("left_at", null);

      if (!membersResult.error) {
        const userIds = (membersResult.data ?? []).map((row) => row.user_id);
        const profilesResult =
          userIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds)
            : {
                data: [] as { id: string; full_name: string | null }[],
                error: null,
              };

        const nameById = new Map<string, string>();
        if (!profilesResult.error) {
          for (const profile of profilesResult.data ?? []) {
            nameById.set(profile.id, profile.full_name || "کاربر");
          }
        }

        members = userIds.map((userId) => ({
          user_id: userId,
          full_name: nameById.get(userId) ?? "کاربر",
        }));
      }
    }

    return NextResponse.json({
      records: sortFinanceRecords((recordsResult.data ?? []) as FinanceRecord[]),
      members,
      householdId,
    });
  } catch (error) {
    return NextResponse.json(
      { message: mapFinanceError(error) },
      { status: financeErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "درخواست JSON معتبر نیست." },
      { status: 400 },
    );
  }

  const parsed = createFinanceRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات مالی معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await validateCreateFinanceForUser({
      userId: user.id,
      input: parsed.data,
    });

    const { data, error } = await supabase.rpc(
      "create_finance_record",
      toCreateFinanceRpcArgs(parsed.data),
    );

    if (error || !data) {
      throw new Error(error?.message ?? "CREATE_FINANCE_FAILED");
    }

    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: mapFinanceError(error) },
      { status: financeErrorStatus(error) },
    );
  }
}
