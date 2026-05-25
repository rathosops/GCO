import type { Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  permission?: Permission;
  isPublic?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Painel", href: "/painel", permission: "panel.view", isPublic: true },
  { label: "Pacientes", href: "/pacientes", permission: "patients.read" },
  { label: "Operador", href: "/operador", permission: "calls.manage" },
  { label: "Triagem", href: "/triagem", permission: "triage.manage" },
  { label: "Admin", href: "/admin", permission: "tenant.manage" },
];
