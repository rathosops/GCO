import type { User, UserRole } from "@/types/api";

export type Permission =
  | "tenant.read"
  | "tenant.manage"
  | "appointments.read"
  | "appointments.manage"
  | "calls.read"
  | "calls.manage"
  | "rooms.read"
  | "rooms.manage"
  | "triage.read"
  | "triage.manage"
  | "panel.view"
  | "audit.read";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "tenant.read",
    "tenant.manage",
    "appointments.read",
    "appointments.manage",
    "calls.read",
    "calls.manage",
    "rooms.read",
    "rooms.manage",
    "triage.read",
    "triage.manage",
    "panel.view",
    "audit.read",
  ],
  operator: [
    "tenant.read",
    "appointments.read",
    "appointments.manage",
    "calls.read",
    "calls.manage",
    "rooms.read",
    "rooms.manage",
    "panel.view",
  ],
  triage: [
    "tenant.read",
    "appointments.read",
    "calls.read",
    "rooms.read",
    "triage.read",
    "triage.manage",
    "panel.view",
  ],
  doctor: [
    "tenant.read",
    "appointments.read",
    "calls.read",
    "rooms.read",
    "panel.view",
  ],
};

export function permissionsForUser(user: User): string[] {
  return user.permissions && user.permissions.length > 0
    ? user.permissions
    : rolePermissions[user.role];
}

export function can(user: User, permission: Permission): boolean {
  return permissionsForUser(user).includes(permission);
}
