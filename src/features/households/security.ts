export type Visibility = "PRIVATE" | "HOUSEHOLD_SHARED";

export function canAccessHouseholdRecord({
  viewerHouseholdId,
  targetHouseholdId,
}: {
  viewerHouseholdId: string | null;
  targetHouseholdId: string;
}) {
  return Boolean(viewerHouseholdId && viewerHouseholdId === targetHouseholdId);
}

export function canAccessPrivateRecord({
  viewerId,
  ownerId,
  visibility,
  viewerHouseholdId,
  targetHouseholdId,
}: {
  viewerId: string;
  ownerId: string;
  visibility: Visibility;
  viewerHouseholdId: string | null;
  targetHouseholdId: string | null;
}) {
  if (visibility === "PRIVATE") {
    return viewerId === ownerId;
  }

  if (!targetHouseholdId) {
    return false;
  }

  return canAccessHouseholdRecord({
    viewerHouseholdId,
    targetHouseholdId,
  });
}

export function canUseInvitation({
  status,
  expiresAt,
  acceptedAt,
  canceledAt,
  now,
}: {
  status: "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";
  expiresAt: Date;
  acceptedAt: Date | null;
  canceledAt: Date | null;
  now: Date;
}) {
  if (status !== "PENDING") return false;
  if (acceptedAt) return false;
  if (canceledAt) return false;
  if (expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function canModifyMembership({
  requesterRole,
  requesterId,
  targetUserId,
}: {
  requesterRole: "OWNER" | "MEMBER";
  requesterId: string;
  targetUserId: string;
}) {
  if (requesterRole !== "OWNER") return false;
  if (requesterId === targetUserId) return false;
  return true;
}
