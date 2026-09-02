import { Bell, CalendarDays, Heart, Search } from "lucide-react";
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
import { Card } from "@/shared/ui/card";
import { SproutDecor } from "@/shared/ui/decor";
import { ErrorState } from "@/shared/ui/error-state";
import { HeaderIconLink, PageHeader } from "@/shared/ui/page-header";
import { SectionLabel } from "@/shared/ui/section-label";
import { formatJalaliLongDate } from "@/shared/utils/jalali";
import { toPersianNumber } from "@/shared/utils/locale";

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
          title="خانه"
          subtitle="برای شروع، یک خانه بسازید یا با دعوت شریک‌تان وارد شوید."
          decor
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

  const nowIso = new Date().toISOString();
  const [openTasksResult, upcomingEventsResult, remindersCountResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .in("status", ["PENDING", "IN_PROGRESS"]),
      supabase
        .from("events")
        .select("id, title, start_at, all_day", { count: "exact" })
        .gte("start_at", nowIso)
        .order("start_at", { ascending: true })
        .limit(2),
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["PENDING", "SNOOZED"]),
    ]);

  const openTasksCount = openTasksResult.count ?? 0;
  const upcomingEvents = upcomingEventsResult.data ?? [];
  const upcomingEventsCount = upcomingEventsResult.count ?? 0;
  const activeRemindersCount = remindersCountResult.count ?? 0;

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

  const stats = [
    { value: openTasksCount, label: "کار", note: "باز" },
    { value: upcomingEventsCount, label: "رویداد", note: "پیش رو" },
    { value: activeRemindersCount, label: "یادآوری", note: "فعال" },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        title="خانه"
        subtitle="خانه‌ی ما، جای آرامش ماست."
        decor
        action={
          <div className="flex items-center gap-2">
            <HeaderIconLink href="/search" label="جستجو">
              <Search className="size-[18px]" strokeWidth={1.6} />
            </HeaderIconLink>
            <HeaderIconLink href="/settings" label="اعلان‌ها و تنظیمات">
              <Bell className="size-[18px]" strokeWidth={1.6} />
            </HeaderIconLink>
          </div>
        }
      />

      <Card className="relative overflow-hidden p-5">
        <div className="flex items-center justify-center gap-6">
          {choreMembers.slice(0, 2).map((member, index) => (
            <div
              key={member.userId}
              className={
                index === 0
                  ? "flex flex-col items-center gap-1.5 text-center"
                  : "order-2 flex flex-col items-center gap-1.5 text-center"
              }
            >
              <span className="flex size-14 items-center justify-center rounded-full border border-line bg-clay-soft text-lg font-bold text-clay-ink">
                {(member.fullName || "؟").slice(0, 1)}
              </span>
              <span className="max-w-24 truncate text-[13px] font-semibold text-ink">
                {member.fullName}
              </span>
            </div>
          ))}
          <span className="order-1 flex size-9 items-center justify-center rounded-full bg-olive-soft text-olive-ink">
            <Heart className="size-4" strokeWidth={1.8} />
          </span>
        </div>
        <p className="mt-3 text-center text-[12px] text-muted">
          {householdResult.data.name} ·{" "}
          {toPersianNumber(normalizedMembers.length)} عضو
        </p>
      </Card>

      <section className="space-y-3">
        <SectionLabel
          action={
            <a href="/today" className="hover:underline">
              مشاهده همه ‹
            </a>
          }
        >
          امروز مهمه
        </SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label + stat.note}
              className="rounded-card border border-line bg-card p-3.5 text-center shadow-paper"
            >
              <p className="text-[22px] font-bold leading-8 text-ink">
                {toPersianNumber(stat.value)}
              </p>
              <p className="text-[11.5px] font-medium text-ink-soft">
                {stat.label}
              </p>
              <p className="text-[10.5px] text-muted">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>رویدادهای پیش رو</SectionLabel>
        {upcomingEvents.length === 0 ? (
          <p className="rounded-field border border-dashed border-line-strong/70 px-3 py-4 text-center text-[13px] text-muted">
            فعلاً رویدادی پیش رو ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <a
                key={event.id}
                href="/calendar"
                className="relative flex items-center gap-3.5 overflow-hidden rounded-card border border-kraft/80 bg-kraft/20 p-4 shadow-paper transition hover:bg-kraft/30"
              >
                <SproutDecor className="pointer-events-none absolute -left-1 bottom-0 size-9 opacity-25" />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-olive-ink shadow-paper">
                  <CalendarDays className="size-[18px]" strokeWidth={1.6} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {event.title}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {formatJalaliLongDate(new Date(event.start_at))}
                    {event.all_day ? " · تمام روز" : ""}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

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
