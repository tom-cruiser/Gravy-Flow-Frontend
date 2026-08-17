'use client';

import { useState } from 'react';
import { Eye, RefreshCcw, Search, Square, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useClusterOverviewQuery,
  useDeploymentEnvQuery,
  useDeploymentsQuery,
  useForceStopDeploymentMutation,
  usePurgeDeploymentCacheMutation,
  useRestartDeploymentMutation,
} from '@/lib/adminQueries';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  running: 'success',
  building: 'warning',
  deploying: 'warning',
  stopped: 'default',
  failed: 'destructive',
};

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

export default function AdminInfrastructurePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [envDeploymentId, setEnvDeploymentId] = useState<string | null>(null);

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
                <TableHead className="w-56">Actions</TableHead>
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
                    <Badge variant={STATUS_VARIANT[d.Status] ?? 'default'}>{d.Status}</Badge>
                  </TableCell>
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
                  <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
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
    </div>
  );
}
