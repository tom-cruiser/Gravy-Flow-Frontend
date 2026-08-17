'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Server,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { AdminRoute } from '@/components/auth/AdminRoute';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/infrastructure', label: 'Infrastructure', icon: Server },
  { href: '/admin/abuse', label: 'Abuse & Risk', icon: AlertTriangle },
  { href: '/admin/audit-logs', label: 'Audit Log', icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mfaEnabled = useAuthStore((s) => s.user?.mfaEnabled);
  const [collapsed, setCollapsed] = useState(false);

  // MFA is opt-in (AdminMiddleware only requires isAdmin, not mfaEnabled —
  // see auth.go), so there's no server-forced redirect into /admin/mfa-setup
  // here. It's reachable only via the "Security" nav item below, and the
  // login page's OTP step only appears for accounts that already enrolled.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } }));

  return (
    <AdminRoute>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen bg-brand-950">
          <aside
            className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-brand-700/50 bg-brand-900/60 backdrop-blur-md transition-all ${
              collapsed ? 'w-[72px]' : 'w-64'
            }`}
          >
            <div className="flex items-center justify-between border-b border-brand-700/50 px-4 py-5">
              {!collapsed && (
                <Link href="/admin" className="text-sm font-bold tracking-tight text-white">
                  Gravy<span className="text-brand-300">Flow</span>{' '}
                  <span className="text-zinc-500">Admin</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="rounded-gf p-1.5 text-zinc-500 transition-colors hover:bg-brand-800/60 hover:text-zinc-200"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-gf px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent text-zinc-900 shadow-glow-accent'
                        : 'text-zinc-400 hover:bg-brand-800/60 hover:text-zinc-100'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-1 border-t border-brand-700/50 p-3">
              <Link
                href="/admin/mfa-setup"
                className="flex items-center gap-3 rounded-gf px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-brand-800/60 hover:text-zinc-100"
                title={collapsed ? 'Security' : undefined}
              >
                <ShieldCheck className={`h-4 w-4 shrink-0 ${mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}`} />
                {!collapsed && <span>Security {mfaEnabled ? '(MFA on)' : '(MFA off)'}</span>}
              </Link>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex w-full items-center gap-3 rounded-gf px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-brand-800/60 hover:text-zinc-200"
                title={collapsed ? 'Back to dashboard' : undefined}
              >
                <Activity className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Back to dashboard</span>}
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
        </div>
      </QueryClientProvider>
    </AdminRoute>
  );
}
