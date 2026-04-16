// ============================================================
// kove Permission Engine
// Computes union of tag permissions, checks individual perms
// ============================================================

import {
  type PermissionSet,
  EMPTY_PERMISSIONS,
  OWNER_PERMISSIONS,
  type PermissionTag,
  type User,
} from "@/lib/types/database";

/**
 * Compute the union of multiple permission tags.
 * If ANY tag grants a permission, the user has it.
 */
export function computePermissions(tags: PermissionTag[]): PermissionSet {
  if (tags.length === 0) return { ...EMPTY_PERMISSIONS };

  const result = { ...EMPTY_PERMISSIONS };

  for (const tag of tags) {
    for (const key of Object.keys(result) as (keyof PermissionSet)[]) {
      if (tag.permissions[key]) {
        result[key] = true;
      }
    }
  }

  return result;
}

/**
 * Get effective permissions for a user.
 * Owner always gets full access — bypasses tag system entirely.
 */
export function getEffectivePermissions(user: User): PermissionSet {
  if (user.is_owner) return { ...OWNER_PERMISSIONS };
  return user.computed_permissions;
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  user: User,
  permission: keyof PermissionSet
): boolean {
  if (user.is_owner) return true;
  return user.computed_permissions[permission] === true;
}

/**
 * Check if a user can view a specific contact.
 * Owner: always. view_all_contacts: always. Otherwise: only if assigned.
 */
export function canViewContact(user: User, contactAssignedTo: string[]): boolean {
  if (user.is_owner) return true;
  if (user.computed_permissions.view_all_contacts) return true;
  return contactAssignedTo.includes(user.id);
}

/**
 * Permission groups for the tag creation UI.
 * Each group has a label and the permission keys + display names.
 */
export const PERMISSION_GROUPS = [
  {
    label: "Data Access",
    permissions: [
      { key: "view_all_contacts" as const, label: "View all contacts (not just their own)" },
      { key: "view_all_activities" as const, label: "View all activities (not just their own)" },
      { key: "view_team_commissions" as const, label: "View team commission data" },
      { key: "view_team_analytics" as const, label: "View team analytics and performance" },
      { key: "view_business_analytics" as const, label: "View business health and strategy data" },
    ],
  },
  {
    label: "Actions",
    permissions: [
      { key: "create_contacts" as const, label: "Create new contacts" },
      { key: "edit_contacts" as const, label: "Edit contacts" },
      { key: "delete_contacts" as const, label: "Delete contacts" },
      { key: "assign_contacts" as const, label: "Assign leads to other users" },
      { key: "approve_commissions" as const, label: "Approve commissions" },
      { key: "create_workflows" as const, label: "Create and edit workflows" },
      { key: "manage_users" as const, label: "Manage users and tags" },
      { key: "configure_commissions" as const, label: "Configure commission rules" },
      { key: "access_billing" as const, label: "Access billing and settings" },
    ],
  },
  {
    label: "AI Agent Scope",
    permissions: [
      { key: "ai_team_context" as const, label: "Agent can access team performance data" },
      { key: "ai_business_context" as const, label: "Agent can access full business data" },
    ],
  },
] as const;
