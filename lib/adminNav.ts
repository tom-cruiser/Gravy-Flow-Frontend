import {
  Activity,
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Server,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

// Shared by app/admin/layout.tsx's sidebar and components/admin/AdminTopBar's
// breadcrumb, so the two can't list a page under different labels.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/infrastructure', label: 'Infrastructure', icon: Server },
  { href: '/admin/system-health', label: 'System Health', icon: Activity },
  { href: '/admin/abuse', label: 'Abuse & Risk', icon: AlertTriangle },
  { href: '/admin/audit-logs', label: 'Audit Log', icon: ClipboardList },
];

export function activeAdminNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)));
}
