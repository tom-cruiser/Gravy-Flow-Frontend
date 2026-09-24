'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemHealthQuery } from '@/lib/adminQueries';
import type { ComponentHealth, ComponentStatus } from '@/lib/adminApi';

const STATUS_VARIANT: Record<ComponentStatus, 'success' | 'warning' | 'destructive' | 'default'> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'destructive',
  not_configured: 'default',
};

const STATUS_LABEL: Record<ComponentStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Down',
  not_configured: 'Not configured',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function percent(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0;
}

// Keys in a component's `details` that hold bytes or seconds, so they render
// human-readable instead of as raw integers.
const BYTE_KEYS = new Set([
  'sizeBytes',
  'used_memory',
  'used_memory_peak',
  'maxmemory',
  'hostMemoryBytes',
]);
const SECOND_KEYS = new Set(['uptime_in_seconds']);

const DETAIL_LABELS: Record<string, string> = {
  poolTotalConns: 'Pool connections',
  poolIdleConns: 'Pool idle',
  poolAcquiredConns: 'Pool in use',
  poolMaxConns: 'Pool max',
  poolAcquireCount: 'Pool acquires',
  serverConnections: 'Server connections',
  maxConnections: 'Max connections',
  serverStartedAt: 'Server started',
  schemaVersion: 'Schema version',
  sizeBytes: 'Database size',
  redis_version: 'Version',
  uptime_in_seconds: 'Uptime',
  connected_clients: 'Clients',
  blocked_clients: 'Blocked clients',
  used_memory: 'Memory used',
  used_memory_peak: 'Memory peak',
  maxmemory: 'Max memory',
  total_commands_processed: 'Commands processed',
  instantaneous_ops_per_sec: 'Ops/sec',
  keyspace_hits: 'Keyspace hits',
  keyspace_misses: 'Keyspace misses',
  evicted_keys: 'Evicted keys',
  processedToday: 'Processed today',
  failedToday: 'Failed today',
  processedTotal: 'Processed total',
  failedTotal: 'Failed total',
  latencyMs: 'Queue latency (ms)',
  hostOs: 'Host OS',
  hostKernel: 'Host kernel',
  hostArch: 'Host arch',
  hostCpus: 'Host CPUs',
  hostMemoryBytes: 'Host memory',
  containersRunning: 'Running',
  containersStopped: 'Stopped',
  containersPaused: 'Paused',
  serverVersion: 'Version',
  apiVersion: 'API version',
  storageDriver: 'Storage driver',
  adminUrl: 'Admin URL',
  appId: 'App ID',
};

function formatDetail(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (BYTE_KEYS.has(key) && typeof value === 'number') {
    return key === 'maxmemory' && value === 0 ? 'unlimited' : formatBytes(value);
  }
  if (SECOND_KEYS.has(key) && typeof value === 'number') return formatDuration(value);
  if (key === 'serverStartedAt' && typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function humanizeKey(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function UsageBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-rose-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-800">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function Stat({ label, value, sub, usage }: { label: string; value: string; sub?: string; usage?: number }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      {usage !== undefined && <UsageBar value={usage} />}
    </div>
  );
}

function ComponentCard({ component }: { component: ComponentHealth }) {
  const details = Object.entries(component.details ?? {}).filter(([key]) => key !== 'warnings');
  const warnings = component.details?.warnings as string[] | undefined;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{component.name}</CardTitle>
        <div className="flex items-center gap-2">
          {component.status !== 'not_configured' && (
            <span className="font-mono text-xs text-zinc-500">{component.latencyMs.toFixed(1)} ms</span>
          )}
          <Badge variant={STATUS_VARIANT[component.status]}>{STATUS_LABEL[component.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {component.error && (
          <p className="rounded-gf border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {component.error}
          </p>
        )}
        {details.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {details.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="truncate text-zinc-500">{humanizeKey(key)}</dt>
                <dd className="truncate text-right font-mono text-zinc-300" title={formatDetail(key, value)}>
                  {formatDetail(key, value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {warnings && warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSystemHealthPage() {
  const health = useSystemHealthQuery();
  const data = health.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">System Health</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live status of the API, its dependencies, and the machine it runs on. Refreshes every 10 seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <>
              <span className="text-xs text-zinc-500">Checked {new Date(data.checkedAt).toLocaleTimeString()}</span>
              <Badge variant={STATUS_VARIANT[data.status]}>Overall: {STATUS_LABEL[data.status]}</Badge>
            </>
          )}
          <Button size="sm" variant="outline" disabled={health.isFetching} onClick={() => health.refetch()}>
            <RefreshCcw className={`mr-1.5 h-4 w-4 ${health.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {health.isError && (
        <p className="rounded-gf border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not reach the API health endpoint — the API itself may be down.
        </p>
      )}

      {health.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      ) : (
        data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Host</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat
                    label="CPU"
                    value={data.host.cpuUsagePercent !== undefined ? `${data.host.cpuUsagePercent.toFixed(1)}%` : '—'}
                    sub={`${data.host.cpuCount} cores · load ${data.host.loadAverage?.map((l) => l.toFixed(2)).join(' / ') ?? '—'}`}
                    usage={data.host.cpuUsagePercent}
                  />
                  <Stat
                    label="Memory"
                    value={formatBytes(data.host.memoryTotalBytes - data.host.memoryAvailableBytes)}
                    sub={`of ${formatBytes(data.host.memoryTotalBytes)}`}
                    usage={percent(data.host.memoryTotalBytes - data.host.memoryAvailableBytes, data.host.memoryTotalBytes)}
                  />
                  <Stat
                    label={`Disk (${data.host.diskPath})`}
                    value={formatBytes(data.host.diskTotalBytes - data.host.diskFreeBytes)}
                    sub={`${formatBytes(data.host.diskFreeBytes)} free of ${formatBytes(data.host.diskTotalBytes)}`}
                    usage={percent(data.host.diskTotalBytes - data.host.diskFreeBytes, data.host.diskTotalBytes)}
                  />
                  <Stat label="Host uptime" value={formatDuration(data.host.uptimeSeconds)} sub={data.host.hostname} />
                </div>
                <p className="text-xs text-zinc-500">
                  {data.host.os} · kernel {data.host.kernel || '—'} · {data.host.arch}
                  {data.host.containerized && ' · running in a container (memory/disk are the container’s view)'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API process</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Stat
                  label="Uptime"
                  value={formatDuration(data.process.uptimeSeconds)}
                  sub={`since ${new Date(data.process.startedAt).toLocaleString()}`}
                />
                <Stat
                  label="Heap in use"
                  value={formatBytes(data.process.heapAllocBytes)}
                  sub={`${formatBytes(data.process.sysBytes)} reserved from OS`}
                />
                <Stat label="Goroutines" value={data.process.goroutines.toLocaleString()} sub={`PID ${data.process.pid}`} />
                <Stat
                  label="Garbage collections"
                  value={data.process.numGc.toLocaleString()}
                  sub={`last pause ${data.process.lastGcPauseUs.toFixed(0)} µs · ${data.process.goVersion}`}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.components.map((c) => (
                <ComponentCard key={c.name} component={c} />
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}
