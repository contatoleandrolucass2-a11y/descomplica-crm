import type { PermissionKey } from "@/lib/authorization/permissions";
import type { RoleKey } from "@/lib/authorization/roles";

export type UserAccessStatus = "pending" | "approved" | "suspended" | "legacy_review";
export type UserDirectoryStatusFilter = "all" | "active" | "inactive" | "pending";

export interface UserPermissionOverride {
  permissionKey: PermissionKey;
  effect: "allow" | "deny";
  reason: string | null;
}

export interface ManagedUser {
  userId: string;
  email: string | null;
  isActive: boolean;
  accessStatus: UserAccessStatus;
  roleKey: RoleKey | null;
  isSelf: boolean;
  isManageable: boolean;
  inheritedPermissions: PermissionKey[];
  overrides: UserPermissionOverride[];
  permissionDetailsAvailable: boolean;
}

export interface UserDirectorySummary {
  total: number | null;
  active: number | null;
  pending: number | null;
  revoked: number | null;
}

export interface UserDirectoryPage {
  users: ManagedUser[];
  nextOffset: number | null;
  hasMore: boolean;
  totalCount: number | null;
  onboardingFoundationAvailable: boolean;
  summary: UserDirectorySummary | null;
}

export interface LoadUsersPageInput {
  offset: number;
  search?: string;
  status?: UserDirectoryStatusFilter;
}

export type LoadUsersPageActionResult =
  | { status: "success"; page: UserDirectoryPage }
  | { status: "error"; message: string };
