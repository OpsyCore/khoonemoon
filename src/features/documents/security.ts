import type { DocumentVisibility } from "@/features/documents/types";

export function isValidDocumentVisibilityPairing({
  visibility,
  householdId,
}: {
  visibility: DocumentVisibility;
  householdId: string | null;
}) {
  if (visibility === "PRIVATE") {
    return householdId === null;
  }
  return householdId !== null;
}

export function canAccessDocument({
  viewerId,
  createdBy,
  visibility,
  householdId,
  viewerHouseholdId,
}: {
  viewerId: string;
  createdBy: string;
  visibility: DocumentVisibility;
  householdId: string | null;
  viewerHouseholdId: string | null;
}) {
  if (!isValidDocumentVisibilityPairing({ visibility, householdId })) {
    return false;
  }
  if (visibility === "PRIVATE") {
    return viewerId === createdBy;
  }
  return Boolean(
    householdId && viewerHouseholdId && householdId === viewerHouseholdId,
  );
}

export function documentStoragePrefix({
  visibility,
  userId,
  householdId,
}: {
  visibility: DocumentVisibility;
  userId: string;
  householdId: string | null;
}) {
  if (visibility === "PRIVATE") {
    return `user/${userId}`;
  }
  return `household/${householdId}`;
}

export function isDocumentStoragePathAllowed({
  storagePath,
  visibility,
  userId,
  householdId,
}: {
  storagePath: string;
  visibility: DocumentVisibility;
  userId: string;
  householdId: string | null;
}) {
  const prefix = documentStoragePrefix({ visibility, userId, householdId });
  return (
    storagePath.startsWith(`${prefix}/`) &&
    !storagePath.includes("..") &&
    !storagePath.startsWith("/")
  );
}
