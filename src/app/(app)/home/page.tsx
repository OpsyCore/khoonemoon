import { ChoreManager } from "@/features/chores/components/chore-manager";
import { HomeFinanceSection } from "@/features/finance/components/home-finance-section";
import { HouseholdManager } from "@/features/households/components/household-manager";
import type {
  HouseholdInvitation,
  HouseholdMember,
  HouseholdRole,
  HouseholdSummary,
} from "@/features/households/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/shared/ui/error-state";
import { PageHeader } from "@/shared/ui/page-header";
import { SectionLabel } from "@/shared/ui/section-label";

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
        description={
          membershipError.message || "اطلاعات عضویت خانه قابل دریافت نیست."
        }
      />
    );
  }

  if (!membership) {
    return (
      <div className="space-y-7">
        <PageHeader
          kicker="زندگی مشترک"
          title="خونه"
          subtitle="برای شروع، یک خانه بسازید یا با دعوت شریک‌تان وارد شوید."
        />

        <HomeFinanceSection />

        <section className="space-y-3">
          <SectionLabel>خانه و اعضا</SectionLabel>
          <HouseholdManager
            household={null}
            members={[]}
            invitations={[]}
            role={null}
            prefillInviteCode={prefillInviteCode}
          />
        </section>
      </div>
    );
  }

  const householdId = membership.household_id;

  const householdResult = await supabase
    .from("households")
    .select("id, name, created_by, created_at, updated_at")
    .eq("id", householdId)
    .single();

  if (householdResult.error || !householdResult.data) {
    return (
      <ErrorState
        title="خطا در بارگذاری خانه"
        description={
          householdResult.error?.message ||
          "اطلاعات خانه پیدا نشد. لطفاً دوباره وارد شوید یا خانه جدید بسازید."
        }
      />
    );
  }

  const membersResult = await supabase
    .from("household_members")
    .select("id, user_id, role, joined_at, left_at")
    .eq("household_id", householdId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (membersResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری اعضا"
        description={membersResult.error.message}
      />
    );
  }

  const memberRows = membersResult.data ?? [];
  const userIds = memberRows.map((m) => m.user_id);

  const profilesResult =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[], error: null };

  const profileNameById = new Map<string, string>();
  if (!profilesResult.error) {
    for (const profile of profilesResult.data ?? []) {
      profileNameById.set(profile.id, profile.full_name || "کاربر");
    }
  }

  const invitationsResult = await supabase
    .from("household_invitations")
    .select("id, status, expires_at, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (invitationsResult.error) {
    return (
      <ErrorState
        title="خطا در بارگذاری دعوت‌نامه‌ها"
        description={invitationsResult.error.message}
      />
    );
  }

  const normalizedMembers: HouseholdMember[] = memberRows.map((member) => ({
    id: member.id,
    user_id: member.user_id,
    role: member.role as HouseholdRole,
    joined_at: member.joined_at,
    left_at: member.left_at,
    profiles: [
      {
        full_name: profileNameById.get(member.user_id) ?? "کاربر",
      },
    ],
  }));

  const normalizedInvitations: HouseholdInvitation[] = (
    invitationsResult.data ?? []
  ).map((invitation) => ({
    id: invitation.id,
    status: invitation.status as HouseholdInvitation["status"],
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
  }));

  const choreMembers = normalizedMembers.map((member) => {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    return {
      userId: member.user_id,
      fullName: profile?.full_name ?? "کاربر",
    };
  });

  return (
    <div className="space-y-7">
      <PageHeader
        kicker="زندگی مشترک"
        title="خونه"
        subtitle="خانه، اعضا، دعوت‌نامه‌ها و کارهای مشترک در همین دفتر."
      />

      <HomeFinanceSection />

      <ChoreManager
        householdId={householdId}
        userId={user.id}
        initialMembers={choreMembers}
      />

      <section className="space-y-3">
        <SectionLabel>خانه و اعضا</SectionLabel>
        <HouseholdManager
          household={householdResult.data as HouseholdSummary}
          members={normalizedMembers}
          invitations={normalizedInvitations}
          role={membership.role as HouseholdRole}
          prefillInviteCode={prefillInviteCode}
        />
      </section>
    </div>
  );
}
