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
  { label: "Consultas", href: "/consultas", permission: "clinical_records.read" },
  { label: "Receituarios", href: "/receituarios", permission: "prescriptions.read" },
  { label: "Exames", href: "/exames", permission: "exam_requests.read" },
  { label: "Operador", href: "/operador", permission: "calls.manage" },
  { label: "Triagem", href: "/triagem", permission: "triage.manage" },
  { label: "Admin", href: "/admin", permission: "tenant.manage" },
];
