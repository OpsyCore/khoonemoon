import { HouseholdManager } from "@/features/households/components/household-manager";
import type {
  HouseholdInvitation,
  HouseholdMember,
  HouseholdRole,
  HouseholdSummary,
} from "@/features/households/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ inviteCode?: string }>;
}) {
  const params = await searchParams;
  const prefillInviteCode = params.inviteCode;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <ErrorState
        title="دسترسی غیرمجاز"
        description="برای مدیریت خانه باید وارد حساب شوید."
      />
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  if (membershipError) {
    return (
      <ErrorState
        title="خطا در دریافت عضویت"
        description="اطلاعات عضویت خانه قابل دریافت نیست."
      />
    );
  }

  if (!membership) {
    return (
      <div className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">خونه</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            برای شروع، یک خانه بسازید یا با دعوت شریک‌تان وارد شوید.
          </p>
        </section>

        <HouseholdManager
          household={null}
          members={[]}
          invitations={[]}
          role={null}
          prefillInviteCode={prefillInviteCode}
        />
      </div>
    );
  }

  const [householdResult, membersResult, invitationsResult] = await Promise.all(
    [
      supabase
        .from("households")
        .select("id, name, created_by, created_at, updated_at")
        .eq("id", membership.household_id)
        .single(),
      supabase
        .from("household_members")
        .select("id, user_id, role, joined_at, left_at, profiles(full_name)")
        .eq("household_id", membership.household_id)
        .is("left_at", null)
        .order("joined_at", { ascending: true }),
      supabase
        .from("household_invitations")
        .select("id, status, expires_at, created_at")
        .eq("household_id", membership.household_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ],
  );

  if (householdResult.error || membersResult.error || invitationsResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری خانه"
        description="لطفاً دوباره تلاش کنید."
      />
    );
  }

  const normalizedMembers: HouseholdMember[] = (membersResult.data ?? []).map(
    (member) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role as HouseholdRole,
      joined_at: member.joined_at,
      left_at: member.left_at,
      profiles: member.profiles,
    }),
  );

  const normalizedInvitations: HouseholdInvitation[] = (
    invitationsResult.data ?? []
  ).map((invitation) => ({
    id: invitation.id,
    status: invitation.status as HouseholdInvitation["status"],
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
  }));

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">خونه</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          مدیریت خانه، اعضا، دعوت‌نامه‌ها و دسترسی‌ها در این بخش انجام می‌شود.
        </p>
      </section>

      <HouseholdManager
        household={householdResult.data as HouseholdSummary}
        members={normalizedMembers}
        invitations={normalizedInvitations}
        role={membership.role as HouseholdRole}
        prefillInviteCode={prefillInviteCode}
      />
    </div>
  );
}
