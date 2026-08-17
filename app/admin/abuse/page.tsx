'use client';

import { useState } from 'react';
import { Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsolateRiskAlertMutation, useRiskAlertsQuery } from '@/lib/adminQueries';

export default function AdminAbusePage() {
  const [status, setStatus] = useState('open');
  const riskAlerts = useRiskAlertsQuery(status === 'all' ? undefined : status);
  const isolate = useIsolateRiskAlertMutation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Abuse & risk</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Alerts are computed on demand from live CPU usage — opening this page refreshes them.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {riskAlerts.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="gf-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {riskAlerts.data?.alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="text-zinc-200">{alert.userEmail}</TableCell>
                  <TableCell className="text-zinc-400">{alert.appName || '—'}</TableCell>
                  <TableCell className="max-w-xs truncate text-zinc-400">{alert.reason}</TableCell>
                  <TableCell>
                    <span className={alert.riskScore >= 75 ? 'font-semibold text-rose-300' : 'text-amber-300'}>
                      {alert.riskScore}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={alert.status === 'open' ? 'warning' : 'default'}>{alert.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {alert.status === 'open' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isolate.isPending}
                        onClick={() => isolate.mutate({ alertId: alert.id, deploymentId: alert.deploymentId ?? undefined })}
                      >
                        <Siren className="mr-1.5 h-3.5 w-3.5" /> Isolate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {riskAlerts.data?.alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    No risk alerts.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
