'use client';

import { useEffect, useState } from 'react';
import { Cpu, Eye, RefreshCcw, Search, Square, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useClusterOverviewQuery,
  useDeploymentEnvQuery,
  useDeploymentsQuery,
  useForceStopDeploymentMutation,
  usePurgeDeploymentCacheMutation,
  useRestartDeploymentMutation,
  useUpdateDeploymentResourcesMutation,
} from '@/lib/adminQueries';
import type { AdminDeploymentSummary } from '@/lib/adminApi';
import { deploymentStatusLabel, deploymentStatusVariant } from '@/lib/deploymentStatus';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function EnvInspectorDialog({ deploymentId, onClose }: { deploymentId: string | null; onClose: () => void }) {
  const env = useDeploymentEnvQuery(deploymentId);
  return (
    <Dialog open={!!deploymentId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Environment variables</DialogTitle>
          <DialogDescription>
            Sensitive values always render masked — this view never exposes secrets, even to admins.
          </DialogDescription>
        </DialogHeader>
        {env.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {env.data?.envVars.map((v) => (
              <div
                key={v.key}
                className="grid grid-cols-[1.2fr_1.8fr] gap-3 rounded-gf border border-brand-700/40 bg-brand-800/30 px-3 py-2 text-sm"
              >
                <span className="truncate font-mono text-zinc-300">{v.key}</span>
                <span className="truncate font-mono text-zinc-500">{v.sensitive ? '••••••••' : v.value || '(empty)'}</span>
              </div>
            ))}
            {env.data?.envVars.length === 0 && <p className="text-sm text-zinc-500">No environment variables set.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Keep in sync with build_settings.go (minAppMemoryMB … maxAppCPU).
const MEMORY_MIN = 128;
const MEMORY_MAX = 16384;
const CPU_MIN = 0.1;
const CPU_MAX = 8;

function ResourcesDialog({ deployment, onClose }: { deployment: AdminDeploymentSummary | null; onClose: () => void }) {
  const update = useUpdateDeploymentResourcesMutation();
  const [memory, setMemory] = useState('');
  const [cpu, setCpu] = useState('');
  const [applyNow, setApplyNow] = useState(true);

  useEffect(() => {
    setMemory(deployment?.memoryMB ? String(deployment.memoryMB) : '');
    setCpu(deployment?.cpu ? String(deployment.cpu) : '');
    setApplyNow(true);
  }, [deployment]);

  const parsedMemory = memory.trim() === '' ? 0 : Number(memory);
  const parsedCpu = cpu.trim() === '' ? 0 : Number(cpu);
  const memoryInvalid = !Number.isInteger(parsedMemory) || (parsedMemory !== 0 && (parsedMemory < MEMORY_MIN || parsedMemory > MEMORY_MAX));
  const cpuInvalid = !Number.isFinite(parsedCpu) || (parsedCpu !== 0 && (parsedCpu < CPU_MIN || parsedCpu > CPU_MAX));
  const running = deployment?.Status === 'RUNNING';

  const save = () => {
    if (!deployment || memoryInvalid || cpuInvalid) return;
    update.mutate(
      { deploymentId: deployment.DeploymentID, memoryMB: parsedMemory, cpu: parsedCpu, applyNow: running && applyNow },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!deployment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resources — {deployment?.AppName}</DialogTitle>
          <DialogDescription>
            Container memory and CPU for this service. Leave a field empty for the platform default (512 MB, 0.5 CPU).
            The owner&apos;s quota isn&apos;t enforced here, but you&apos;ll be warned if these limits exceed it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-memory">Memory (MB)</Label>
            <Input
              id="admin-memory"
              inputMode="numeric"
              value={memory}
              placeholder="512"
              onChange={(e) => setMemory(e.target.value.replace(/[^0-9]/g, ''))}
            />
            {memoryInvalid && <p className="text-xs text-rose-300">Between {MEMORY_MIN} and {MEMORY_MAX} MB.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-cpu">CPU (cores)</Label>
            <Input
              id="admin-cpu"
              inputMode="decimal"
              value={cpu}
              placeholder="0.5"
              onChange={(e) => setCpu(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            {cpuInvalid && <p className="text-xs text-rose-300">Between {CPU_MIN} and {CPU_MAX} cores.</p>}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-gf border border-brand-700/40 bg-brand-800/30 px-3 py-2">
          <div>
            <Label htmlFor="admin-apply-now">Restart now to apply</Label>
            <p className="text-xs text-zinc-500">
              {running ? 'Reuses the current image; no rebuild.' : 'Service isn’t running — applies on its next deploy.'}
            </p>
          </div>
          <Switch id="admin-apply-now" checked={running && applyNow} disabled={!running} onCheckedChange={setApplyNow} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending || memoryInvalid || cpuInvalid}>
            {update.isPending ? 'Saving…' : 'Save resources'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminInfrastructurePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [envDeploymentId, setEnvDeploymentId] = useState<string | null>(null);
  const [resourcesDeployment, setResourcesDeployment] = useState<AdminDeploymentSummary | null>(null);

  const cluster = useClusterOverviewQuery();
  const deployments = useDeploymentsQuery(search, page);
  const restart = useRestartDeploymentMutation();
  const forceStop = useForceStopDeploymentMutation();
  const purgeCache = usePurgeDeploymentCacheMutation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Infrastructure</h1>
        <p className="mt-1 text-sm text-zinc-500">Cluster telemetry and per-service controls.</p>
      </div>

      {cluster.data && (
        <Card>
          <CardHeader>
            <CardTitle>Cluster</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-zinc-500">Active containers</p>
              <p className="text-lg font-semibold text-zinc-100">{cluster.data.activeContainers}</p>
            </div>
            <div>
              <p className="text-zinc-500">CPU cores</p>
              <p className="text-lg font-semibold text-zinc-100">{cluster.data.totalCpuCores.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Memory (MB)</p>
              <p className="text-lg font-semibold text-zinc-100">{(cluster.data.totalMemoryBytes / 1024 / 1024).toFixed(0)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Disk (MB)</p>
              <p className="text-lg font-semibold text-zinc-100">{(cluster.data.totalDiskBytes / 1024 / 1024).toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search by app name, owner email, or deployment ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {deployments.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="gf-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="w-64">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.data?.items.map((d) => (
                <TableRow key={d.DeploymentID}>
                  <TableCell>
                    <div className="font-medium text-zinc-100">{d.AppName}</div>
                    <div className="text-xs text-zinc-500">{d.DeploymentID}</div>
                  </TableCell>
                  <TableCell className="text-zinc-400">{d.ownerEmail}</TableCell>
                  <TableCell>
                    <Badge variant={deploymentStatusVariant(d.Status)}>{deploymentStatusLabel(d.Status)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-zinc-400">
                    {d.effectiveMemoryMB} MB · {d.effectiveCpu} CPU
                    {!d.memoryMB && !d.cpu && <span className="ml-1 text-zinc-600">(default)</span>}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">{relativeTime(d.UpdatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Restart"
                        disabled={restart.isPending}
                        onClick={() => restart.mutate(d.DeploymentID)}
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Force stop"
                        disabled={forceStop.isPending}
                        onClick={() => forceStop.mutate({ deploymentId: d.DeploymentID, reason: 'admin force-stop' })}
                      >
                        <Square className="h-4 w-4 text-rose-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Purge build cache"
                        disabled={purgeCache.isPending}
                        onClick={() => purgeCache.mutate(d.DeploymentID)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Resources" onClick={() => setResourcesDeployment(d)}>
                        <Cpu className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Inspect env vars"
                        onClick={() => setEnvDeploymentId(d.DeploymentID)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {deployments.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No deployments match this search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {deployments.data && deployments.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-brand-700/50 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {deployments.data.page} of {deployments.data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= deployments.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <EnvInspectorDialog deploymentId={envDeploymentId} onClose={() => setEnvDeploymentId(null)} />
      <ResourcesDialog deployment={resourcesDeployment} onClose={() => setResourcesDeployment(null)} />
    </div>
  );
}
