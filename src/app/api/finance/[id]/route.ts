import { NextResponse } from "next/server";
import { patchFinanceRecordSchema } from "@/features/finance/schemas";
import type { FinanceMembership } from "@/features/finance/security";
import {
  financeErrorStatus,
  mapFinanceError,
  resolveFinancePaidBy,
  toFinanceUpdateRpcInput,
  toSetFinancePaidRpcArgs,
  toUpdateFinanceRpcArgs,
} from "@/features/finance/server";
import {
  FINANCE_RECORD_SELECT,
  type FinanceRecord,
} from "@/features/finance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function loadRecord(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_records")
    .select(FINANCE_RECORD_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as FinanceRecord;
}

async function loadHouseholdMemberships(
  householdId: string | null,
): Promise<FinanceMembership[]> {
  if (!householdId) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, household_id, left_at")
    .eq("household_id", householdId)
    .is("left_at", null);

  if (error) {
    throw new Error("FAILED_TO_LOAD_MEMBERSHIP");
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    householdId: row.household_id,
    leftAt: row.left_at,
  }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const record = await loadRecord(id);
  if (!record) {
    return NextResponse.json(
      { message: mapFinanceError(new Error("FINANCE_NOT_FOUND")) },
      { status: 404 },
    );
  }

  return NextResponse.json({ record });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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

  const parsed = patchFinanceRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات مالی معتبر نیست.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await loadRecord(id);
  if (!existing) {
    return NextResponse.json(
      { message: mapFinanceError(new Error("FINANCE_NOT_FOUND")) },
      { status: 404 },
    );
  }

  try {
    if (parsed.data.action === "pay" || parsed.data.action === "unpay") {
      if (existing.record_type !== "BILL") {
        throw new Error("FINANCE_NOT_A_BILL");
      }

      const paidBy =
        parsed.data.action === "pay"
          ? resolveFinancePaidBy({
              viewerId: user.id,
              ownerId: existing.owner_id,
              visibility: existing.visibility,
              householdId: existing.household_id,
              paidBy: parsed.data.paidBy,
              memberships: await loadHouseholdMemberships(
                existing.household_id,
              ),
            })
          : null;

      const { data, error } = await supabase.rpc(
        "set_finance_record_paid",
        toSetFinancePaidRpcArgs({
          id,
          paid: parsed.data.action === "pay",
          paidBy,
        }),
      );

      if (error || data === false) {
        throw new Error(error?.message ?? "SET_FINANCE_PAID_FAILED");
      }

      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supabase.rpc(
      "update_finance_record",
      toUpdateFinanceRpcArgs(
        id,
        toFinanceUpdateRpcInput({
          existing,
          patch: parsed.data.data,
        }),
      ),
    );

    if (error || data === false) {
      throw new Error(error?.message ?? "UPDATE_FINANCE_FAILED");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: mapFinanceError(error) },
      { status: financeErrorStatus(error) },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("finance_records")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { message: mapFinanceError(new Error("FINANCE_NOT_FOUND")) },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
