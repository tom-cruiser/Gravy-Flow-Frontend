'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getQuotaSummary, listBillingPlans, upgradePlan, type BillingPlan } from '@/lib/profileApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

function formatStorage(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

// Self-service plan/quota-tier switcher. There is no payment processor wired
// into this codebase — see billing_plans.go's header — so "upgrading" only
// changes the quota limits GravyFlow already enforces (max apps/CPU/storage/
// bandwidth); nothing is charged. The disclaimer below is load-bearing, not
// decorative: a plan picker with prices next to it reads as a checkout, and
// this deliberately isn't one.
export function PlanPicker() {
  const user = useAuthStore((s) => s.user);
  const [plans, setPlans] = useState<BillingPlan[] | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listBillingPlans(), getQuotaSummary(user.id)])
      .then(([planList, summary]) => {
        setPlans(planList);
        setCurrentPlan(summary.quota.plan);
      })
      .catch(() => toast.error('Failed to load subscription plans.', 'Try again'))
      .finally(() => setLoading(false));
    // Only run once per mount — re-fetching on every render would fight
    // with the optimistic setCurrentPlan update in handleSwitch below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSwitch = async (planKey: string) => {
    setSwitchingTo(planKey);
    try {
      const record = await upgradePlan(planKey);
      setCurrentPlan(record.plan);
      toast.success(`You're now on the ${plans?.find((p) => p.key === planKey)?.name ?? planKey} plan.`, 'Plan updated');
    } catch {
      toast.error('Failed to switch plans. Please try again.', 'Error');
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Subscription</CardDescription>
          <CardTitle>Plan &amp; quota</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-gf border border-brand-700/50 bg-brand-800/40 p-3 text-xs text-zinc-500">
          Switching plans updates your resource limits immediately. GravyFlow doesn&apos;t process real payments yet —
          no card is charged.
        </p>

        {loading && <p className="text-sm text-zinc-500">Loading plans…</p>}

        {!loading && plans && (
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              return (
                <div
                  key={plan.key}
                  className={`flex flex-col justify-between gap-3 rounded-gf-2xl border p-4 ${
                    isCurrent ? 'border-accent bg-accent/10' : 'border-brand-700/50 bg-brand-800/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{plan.name}</p>
                      {isCurrent && <Badge variant="accent">Current</Badge>}
                    </div>
                    <p className="text-lg font-semibold text-white">{plan.priceDisplay}</p>
                    <ul className="space-y-1 text-xs text-zinc-400">
                      <li>{plan.maxCpu} CPU cores</li>
                      <li>{formatStorage(plan.maxMemoryMb)} memory</li>
                      <li>{plan.maxApps} apps</li>
                      <li>{formatStorage(plan.maxStorageMb)} storage</li>
                      <li>{plan.maxBandwidthGb} GB bandwidth</li>
                    </ul>
                  </div>
                  <Button
                    size="sm"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || switchingTo !== null}
                    onClick={() => handleSwitch(plan.key)}
                  >
                    {switchingTo === plan.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                    {isCurrent ? 'Current plan' : switchingTo === plan.key ? 'Switching…' : 'Switch to this plan'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
