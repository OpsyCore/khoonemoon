import { canAccessPrivateRecord } from "@/features/households/security";
import {
  FINANCE_VISIBILITIES,
  type FinanceVisibility,
} from "@/features/finance/types";

export type FinanceMembership = {
  userId: string;
  householdId: string;
  leftAt: string | Date | null;
};

export function isFinanceVisibility(
  value: string,
): value is FinanceVisibility {
  return (FINANCE_VISIBILITIES as readonly string[]).includes(value);
}

export function isValidFinanceVisibilityPairing({
  visibility,
  householdId,
}: {
  visibility: FinanceVisibility;
  householdId: string | null;
}) {
  if (visibility === "PRIVATE") {
    return householdId === null;
  }

  return householdId !== null;
}

function isActiveMembership(membership: FinanceMembership) {
  return membership.leftAt == null;
}

function viewerActiveHouseholdId({
  viewerId,
  householdId,
  memberships,
}: {
  viewerId: string;
  householdId: string;
  memberships: readonly FinanceMembership[];
}) {
  const isActiveMember = memberships.some(
    (membership) =>
      membership.userId === viewerId &&
      membership.householdId === householdId &&
      isActiveMembership(membership),
  );

  return isActiveMember ? householdId : null;
}

export function canAccessFinanceRecord({
  viewerId,
  ownerId,
  visibility,
  householdId,
  memberships,
  paidBy: _paidBy,
}: {
  viewerId: string;
  ownerId: string;
  visibility: FinanceVisibility;
  householdId: string | null;
  memberships: readonly FinanceMembership[];
  paidBy?: string | null;
}) {
  if (!isValidFinanceVisibilityPairing({ visibility, householdId })) {
    return false;
  }

  if (visibility === "PRIVATE") {
    return canAccessPrivateRecord({
      viewerId,
      ownerId,
      visibility: "PRIVATE",
      viewerHouseholdId: null,
      targetHouseholdId: null,
    });
  }

  return canAccessPrivateRecord({
    viewerId,
    ownerId,
    visibility: "HOUSEHOLD_SHARED",
    viewerHouseholdId: viewerActiveHouseholdId({
      viewerId,
      householdId: householdId!,
      memberships,
    }),
    targetHouseholdId: householdId,
  });
}

export function validateFinancePaidBy({
  visibility,
  ownerId,
  householdId,
  paidBy,
  memberships,
}: {
  visibility: FinanceVisibility;
  ownerId: string;
  householdId: string | null;
  paidBy: string | null;
  memberships: readonly FinanceMembership[];
}) {
  if (!isValidFinanceVisibilityPairing({ visibility, householdId })) {
    return false;
  }

  if (!paidBy) {
    return true;
  }

  if (visibility === "PRIVATE") {
    return paidBy === ownerId;
  }

  return memberships.some(
    (membership) =>
      membership.userId === paidBy &&
      membership.householdId === householdId &&
      isActiveMembership(membership),
  );
}
