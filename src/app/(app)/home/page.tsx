import Link from "next/link";
import { Bell, CalendarDays, Heart, Search } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { HeaderIconLink } from "@/shared/ui/page-header";
import { SectionLabel } from "@/shared/ui/section-label";
import { formatPersianShortDate, toPersianNumber } from "@/shared/utils/locale";
import { PageHeader } from "@/shared/ui/page-header";
import { loadHouseholdMembers } from "@/features/households/members";
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
        <PageHeader
          title="خونه"
          subtitle="برای شروع، یک خانه بسازید یا با دعوت شریک‌تان وارد شوید."
          decor
        />

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
      loadHouseholdMembers(supabase, membership.household_id),
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

  // Additional overview queries use the caller's RLS, never fabricated counts.
  const now = new Date().toISOString();
  const [openTasks, upcomingEvents, reminders] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in("status", ["PENDING", "IN_PROGRESS"]),
    supabase
      .from("events")
      .select("id, title, start_at, all_day")
      .gte("start_at", now)
      .order("start_at", { ascending: true })
      .limit(2),
    supabase
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["PENDING", "SNOOZED"]),
  ]);

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
      <PageHeader
        title="خانه"
        subtitle="خانه‌ی ما، جای آرامش ماست."
        decor
        action={
          <div className="flex gap-2">
            <HeaderIconLink href="/search" label="جستجو">
              <Search className="size-[18px]" />
            </HeaderIconLink>
            <HeaderIconLink href="/reminders" label="یادآورها">
              <Bell className="size-[18px]" />
            </HeaderIconLink>
          </div>
        }
      />

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-center gap-5">
          {normalizedMembers.slice(0, 2).map((member, index) => {
            const name = member.profiles?.[0]?.full_name ?? "عضو خانه";
            return (
              <div
                key={member.id}
                className={
                  index
                    ? "order-2 flex flex-col items-center gap-1"
                    : "flex flex-col items-center gap-1"
                }
              >
                <span className="flex size-14 items-center justify-center rounded-full border border-line bg-clay-soft text-lg font-bold text-clay-ink">
                  {name.slice(0, 1)}
                </span>
                <span className="text-sm font-medium text-ink">{name}</span>
              </div>
            );
          })}
          <span className="order-1 flex size-9 items-center justify-center rounded-full bg-olive-soft text-olive-ink">
            <Heart className="size-4" />
          </span>
        </div>
        <p className="text-center text-xs text-muted">
          {householdResult.data.name} ·{" "}
          {toPersianNumber(normalizedMembers.length)} عضو
        </p>
      </Card>

      {!openTasks.error && !reminders.error ? (
        <section className="space-y-3">
          <SectionLabel action={<Link href="/today">مشاهده همه ‹</Link>}>
            امروز مهمه
          </SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "کار باز", value: openTasks.count ?? 0 },
              { label: "یادآور فعال", value: reminders.count ?? 0 },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-ink">
                  {toPersianNumber(stat.value)}
                </p>
                <p className="text-xs text-muted">{stat.label}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      <section className="space-y-3">
        <SectionLabel action={<Link href="/calendar">مشاهده تقویم ‹</Link>}>
          رویدادهای پیش رو
        </SectionLabel>
        {upcomingEvents.error ? (
          <p className="text-sm text-danger-ink">دریافت رویدادها ناموفق بود.</p>
        ) : upcomingEvents.data?.length ? (
          upcomingEvents.data.map((event) => (
            <Link
              href="/calendar"
              key={event.id}
              className="flex items-center gap-3 rounded-card border border-line bg-card p-4 shadow-paper"
            >
              <span className="rounded-full bg-olive-soft p-3 text-olive-ink">
                <CalendarDays className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {event.title}
                </span>
                <span className="text-xs text-muted">
                  {formatPersianShortDate(event.start_at)}
                  {event.all_day ? " · تمام روز" : ""}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="rounded-field border border-dashed border-line-strong p-4 text-center text-sm text-muted">
            فعلاً رویدادی پیش رو ثبت نشده است.
          </p>
        )}
      </section>
      <SectionLabel>خانه و اعضا</SectionLabel>

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
