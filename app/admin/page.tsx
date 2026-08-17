'use client';

import Link from 'next/link';
import { AlertTriangle, Cpu, Database, HardDrive, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditLogsQuery, useClusterOverviewQuery, useRiskAlertsQuery } from '@/lib/adminQueries';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div className="rounded-gf border border-brand-700/60 bg-brand-800/60 p-2.5 text-brand-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="truncate text-xl font-semibold text-zinc-100">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const cluster = useClusterOverviewQuery();
  const riskAlerts = useRiskAlertsQuery('open');
  const auditLogs = useAuditLogsQuery({ page: 1, perPage: 8 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Live platform telemetry, sampled from real Docker stats.</p>
      </div>

      {cluster.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : cluster.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Cpu}
            label="CPU in use"
            value={`${cluster.data.totalCpuCores.toFixed(2)} cores`}
            hint={`${cluster.data.activeContainers} active containers`}
          />
          <StatTile icon={MemoryStick} label="Memory in use" value={formatBytes(cluster.data.totalMemoryBytes)} />
          <StatTile icon={HardDrive} label="Disk usage" value={formatBytes(cluster.data.totalDiskBytes)} hint="images + volumes" />
          <StatTile
            icon={Database}
            label="Total deployments"
            value={String(cluster.data.totalDeployments)}
            hint={cluster.data.unreachableCount > 0 ? `${cluster.data.unreachableCount} unreachable` : undefined}
          />
        </div>
      ) : (
        <p className="text-sm text-rose-300">Failed to load cluster overview.</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Module C</CardDescription>
              <CardTitle>Open risk alerts</CardTitle>
            </div>
            <Link href="/admin/abuse" className="gf-link text-xs">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {riskAlerts.isLoading ? (
              <Skeleton className="h-16" />
            ) : riskAlerts.data && riskAlerts.data.alerts.length > 0 ? (
              <ul className="space-y-2">
                {riskAlerts.data.alerts.slice(0, 5).map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center gap-3 rounded-gf border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="min-w-0 flex-1 truncate text-zinc-300">
                      {alert.userEmail} — {alert.reason}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-amber-300">{alert.riskScore}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No open risk alerts.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Module D</CardDescription>
              <CardTitle>Recent admin activity</CardTitle>
            </div>
            <Link href="/admin/audit-logs" className="gf-link text-xs">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {auditLogs.isLoading ? (
              <Skeleton className="h-16" />
            ) : auditLogs.data && auditLogs.data.items.length > 0 ? (
              <ul className="space-y-2">
                {auditLogs.data.items.map((entry) => (
                  <li key={entry.id} className="text-sm text-zinc-400">
                    <span className="font-medium text-zinc-200">{entry.actorEmail}</span>{' '}
                    <span className="font-mono text-xs text-brand-300">{entry.action}</span>{' '}
                    <span className="text-zinc-500">on {entry.targetType}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No audit activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
