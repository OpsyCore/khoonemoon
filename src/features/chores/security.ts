/**
 * Security documentation for Chores feature.
 *
 * This file documents the security model for Chores.
 * Actual enforcement happens in PostgreSQL RLS policies
 * defined in drizzle/0006_milestone7_chores.sql.
 *
 * Key security properties:
 *
 * 1. All Chores are HOUSEHOLD_SHARED (no private chores in MVP).
 * 2. Only members of the household can access chores.
 * 3. chore_completions has unique(chore_id, for_date) constraint.
 * 4. household_id and created_by are immutable after creation.
 *
 * RLS Policies (see migration 0006):
 * - chores_select_household: SELECT requires household membership.
 * - chores_insert_household: INSERT requires membership + valid default_assignee.
 * - chores_update_household: UPDATE requires membership + immutable fields check.
 * - chores_delete_household: DELETE requires membership.
 * - chore_completions_insert_access: completed_by = auth.uid() + manage access.
 * - chore_completions has unique(chore_id, for_date) constraint.
 */

export const CHORE_SECURITY_NOTES = {
  allShared: true,
  requiresHouseholdMembership: true,
  completionUniquePerDate: true,
  immutableFields: ["household_id", "created_by"],
} as const;
