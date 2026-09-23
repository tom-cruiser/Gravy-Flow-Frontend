'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRiskAlertsQuery } from '@/lib/adminQueries';
import { activeAdminNavItem } from '@/lib/adminNav';

// Breadcrumb + at-a-glance chrome shown above every /admin page. The
// notification count is the real open-risk-alert count (same query the
// Overview page's risk-alerts card and /admin/abuse use) — not a stand-in
// value — so it never shows a number the rest of the admin panel disagrees
// with. The identity chip is a display only: the sidebar already owns the
// profile/MFA and log-out affordances, so this isn't a second account menu.
export function AdminTopBar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const riskAlerts = useRiskAlertsQuery('open');

  const activeItem = activeAdminNavItem(pathname);
  const openAlertCount = riskAlerts.data?.alerts.length ?? 0;

  const displayName = user?.displayName?.trim() || user?.email || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-brand-700/50 bg-brand-900/70 px-6 py-4 backdrop-blur-md lg:px-8">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          Admin{activeItem ? ` / ${activeItem.label}` : ''}
        </p>
        <h2 className="mt-0.5 truncate text-lg font-semibold text-zinc-100">{activeItem?.label ?? 'Admin'}</h2>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/admin/abuse"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-gf border border-brand-700/60 bg-brand-800/60 text-zinc-400 transition-colors hover:border-brand-500 hover:text-zinc-100"
          title={openAlertCount > 0 ? `${openAlertCount} open risk alert${openAlertCount === 1 ? '' : 's'}` : 'No open risk alerts'}
        >
          <Bell className="h-4 w-4" />
          {openAlertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {openAlertCount > 99 ? '99+' : openAlertCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2.5 rounded-gf border border-brand-700/60 bg-brand-800/60 py-1.5 pl-1.5 pr-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-brand-200">
            {initial}
          </span>
          <span className="max-w-[10rem] truncate text-sm font-medium text-zinc-200">{displayName}</span>
        </div>
      </div>
    </div>
  );
}
