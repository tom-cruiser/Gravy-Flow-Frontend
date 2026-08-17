'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreditBalanceQuery,
  useIssueCreditMutation,
  useQuotaHistoryQuery,
  useResetQuotaUsageMutation,
  useRestoreQuotaDefaultsMutation,
  useRevokeCreditMutation,
  useUpdateQuotaMutation,
  useUserDetailQuery,
} from '@/lib/adminQueries';
import type { QuotaPatch } from '@/lib/adminApi';

// Module A (identity/usage) + Module C (quota overrides, credit ledger) live
// together here because the backend routes them together too — both are
// scoped to /admin/users/:id/*, per admin.go / admin_billing.go.
export function UserDetailDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const detail = useUserDetailQuery(userId);
  const credits = useCreditBalanceQuery(userId);
  const quotaHistory = useQuotaHistoryQuery(userId);
  const updateQuota = useUpdateQuotaMutation();
  const restoreDefaults = useRestoreQuotaDefaultsMutation();
  const resetUsage = useResetQuotaUsageMutation();
  const issueCredit = useIssueCreditMutation();
  const revokeCredit = useRevokeCreditMutation();

  const [draft, setDraft] = useState<QuotaPatch>({});
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  useEffect(() => {
    if (detail.data) {
      setDraft({
        maxCpu: detail.data.quota.maxCpu,
        maxMemoryMb: detail.data.quota.maxMemoryMb,
        maxApps: detail.data.quota.maxApps,
        maxStorageMb: detail.data.quota.maxStorageMb,
        maxBandwidthGb: detail.data.quota.maxBandwidthGb,
      });
    }
  }, [detail.data]);

  const submitCredit = (kind: 'issue' | 'revoke') => {
    if (!userId) return;
    const cents = Math.round(parseFloat(creditAmount || '0') * 100);
    if (!cents || cents <= 0 || !creditReason.trim()) return;
    const mutate = kind === 'issue' ? issueCredit : revokeCredit;
    mutate.mutate(
      { userId, amountCents: cents, reason: creditReason.trim() },
      { onSuccess: () => { setCreditAmount(''); setCreditReason(''); } },
    );
  };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {detail.isLoading || !detail.data ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{detail.data.user.displayName}</DialogTitle>
              <DialogDescription>{detail.data.user.email}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="quota">
              <TabsList>
                <TabsTrigger value="quota">Quota</TabsTrigger>
                <TabsTrigger value="credits">Credits</TabsTrigger>
                <TabsTrigger value="deployments">Deployments</TabsTrigger>
              </TabsList>

              <TabsContent value="quota" className="space-y-5">
                {([
                  ['maxCpu', 'Max vCPU', 0.5, 16, 0.5, detail.data.usage.currentCpu],
                  ['maxMemoryMb', 'Max memory (MB)', 256, 16384, 256, detail.data.usage.currentMemoryMb],
                  ['maxApps', 'Max apps', 1, 50, 1, detail.data.usage.currentApps],
                  ['maxStorageMb', 'Max storage (MB)', 512, 51200, 512, detail.data.usage.currentStorageMb],
                  ['maxBandwidthGb', 'Max bandwidth (GB)', 10, 2000, 10, undefined],
                ] as const).map(([field, label, min, max, step, current]) => (
                  <div key={field} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field}>{label}</Label>
                      <span className="text-sm text-zinc-300">
                        {draft[field] ?? '—'}
                        {current !== undefined && <span className="text-zinc-500"> (using {current})</span>}
                      </span>
                    </div>
                    <Slider
                      id={field}
                      min={min}
                      max={max}
                      step={step}
                      value={[draft[field] ?? min]}
                      onValueChange={([v]) => setDraft((d) => ({ ...d, [field]: v }))}
                    />
                  </div>
                ))}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={updateQuota.isPending}
                    onClick={() => userId && updateQuota.mutate({ userId, patch: draft })}
                  >
                    Save quota
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoreDefaults.isPending}
                    onClick={() => userId && restoreDefaults.mutate(userId)}
                  >
                    Restore plan defaults
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resetUsage.isPending}
                    onClick={() => userId && resetUsage.mutate(userId)}
                  >
                    Reset usage counters
                  </Button>
                </div>

                {quotaHistory.data && quotaHistory.data.history.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Recent changes</p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-zinc-500">
                      {quotaHistory.data.history.slice(0, 8).map((h) => (
                        <li key={h.id}>
                          <span className="text-zinc-300">{h.field}</span>: {h.oldValue} → {h.newValue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="credits" className="space-y-4">
                <div className="flex items-center justify-between rounded-gf border border-brand-700/50 bg-brand-800/40 px-4 py-3">
                  <span className="text-sm text-zinc-400">Current balance</span>
                  <span className="text-lg font-semibold text-zinc-100">
                    {credits.data ? `$${(credits.data.balanceCents / 100).toFixed(2)}` : '—'}
                  </span>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="creditAmount">Amount (USD)</Label>
                    <Input
                      id="creditAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-[2]">
                    <Label htmlFor="creditReason">Reason</Label>
                    <Input
                      id="creditReason"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. billing dispute credit"
                    />
                  </div>
                  <Button size="sm" onClick={() => submitCredit('issue')} disabled={issueCredit.isPending}>
                    Issue
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => submitCredit('revoke')}
                    disabled={revokeCredit.isPending}
                  >
                    Revoke
                  </Button>
                </div>

                {credits.data && credits.data.history.length > 0 && (
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm">
                    {credits.data.history.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between text-zinc-400">
                        <span>{entry.reason}</span>
                        <span className={entry.entryType === 'issue' ? 'text-emerald-300' : 'text-rose-300'}>
                          {entry.entryType === 'issue' ? '+' : ''}
                          {(entry.amountCents / 100).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="deployments" className="space-y-2">
                {detail.data.deployments.length === 0 ? (
                  <p className="text-sm text-zinc-500">No deployments.</p>
                ) : (
                  detail.data.deployments.map((d) => (
                    <div
                      key={d.DeploymentID}
                      className="flex items-center justify-between rounded-gf border border-brand-700/50 bg-brand-800/40 px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-200">{d.AppName}</span>
                      <Badge variant={d.Status === 'running' ? 'success' : 'default'}>{d.Status}</Badge>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
