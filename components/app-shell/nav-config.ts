// Sidebar navigation groups (§10), filtered by role via ROUTE_ACCESS.
import {
  LayoutDashboard,
  FileStack,
  MapPinned,
  ClipboardCheck,
  FlaskConical,
  FileBadge,
  Mountain,
  Radar,
  BarChart3,
  Database,
  Users,
  ShieldCheck,
  Settings,
  FilePlus2,
  FolderOpen,
  Building2,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { ROUTE_ACCESS } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  labelKey: string; // i18n key under nav.*
  icon: typeof LayoutDashboard;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    labelKey: "nav.overview",
    items: [{ href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.myApplications",
    items: [
      { href: "/portal", labelKey: "nav.myApplications", icon: FolderOpen },
      { href: "/portal/new", labelKey: "nav.newApplication", icon: FilePlus2 },
    ],
  },
  {
    labelKey: "nav.queue",
    items: [{ href: "/authority", labelKey: "nav.queue", icon: Building2 }],
  },
  {
    labelKey: "nav.casework",
    items: [
      { href: "/applications", labelKey: "nav.applications", icon: FileStack },
      { href: "/evaluate", labelKey: "nav.evaluate", icon: MapPinned },
      { href: "/review", labelKey: "nav.review", icon: ClipboardCheck },
      { href: "/studies", labelKey: "nav.studies", icon: FlaskConical },
      { href: "/certificates", labelKey: "nav.certificates", icon: FileBadge },
    ],
  },
  {
    labelKey: "nav.register",
    items: [
      { href: "/obstacles", labelKey: "nav.obstacles", icon: Mountain },
      { href: "/obstacles/monitoring", labelKey: "nav.monitoring", icon: Radar },
    ],
  },
  {
    labelKey: "nav.insight",
    items: [{ href: "/reports", labelKey: "nav.reports", icon: BarChart3 }],
  },
  {
    labelKey: "nav.configuration",
    items: [
      { href: "/master-data", labelKey: "nav.masterData", icon: Database },
      { href: "/users", labelKey: "nav.users", icon: Users },
      { href: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
  {
    labelKey: "nav.compliance",
    items: [{ href: "/audit", labelKey: "nav.audit", icon: ShieldCheck }],
  },
];

function roleCanSee(role: Role, href: string): boolean {
  const entry = Object.keys(ROUTE_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => href === prefix || href.startsWith(prefix + "/"));
  if (!entry) return true;
  return ROUTE_ACCESS[entry].includes(role);
}

/** Groups visible to the given role — groups a role cannot access are hidden. */
export function navForRole(role: Role): NavGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => roleCanSee(role, item.href)),
  })).filter((group) => group.items.length > 0);
}
