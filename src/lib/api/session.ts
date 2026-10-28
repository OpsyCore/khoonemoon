import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type SessionContext = {
  supabase: SupabaseServerClient;
  userId: string;
  householdId: string | null;
};

/**
 * Resolves the current session plus the caller's active household.
 *
 * Every mutation in the app goes through this helper so authorization is
 * checked in one place and never relies on the client.
 */
export async function getSessionContext(): Promise<
  { ok: true; context: SessionContext } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      householdId: (membership?.household_id as string | undefined) ?? null,
    },
  };
}

export function requireHousehold(context: SessionContext) {
  if (!context.householdId) {
    return NextResponse.json(
      {
        message:
          "برای استفاده از این بخش باید عضو یک خانه باشید. ابتدا در صفحه «خونه» خانه بسازید.",
      },
      { status: 409 },
    );
  }

  return null;
}

export function validationError(error: { flatten: () => unknown }) {
  return NextResponse.json(
    { message: "Validation failed", errors: error.flatten() },
    { status: 400 },
  );
}

export function serverError(message: string) {
  return NextResponse.json({ message }, { status: 500 });
}
