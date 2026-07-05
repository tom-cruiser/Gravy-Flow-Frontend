'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type QuotaSummary = {
  quota: {
    userId: string;
    maxCpu: number;
    maxMemoryMb: number;
    maxApps: number;
    maxStorageMb: number;
  };
  usage: {
    userId: string;
    currentCpu: number;
    currentMemoryMb: number;
    currentApps: number;
    currentStorageMb: number;
  };
  available: {
    userId: string;
    maxCpu: number;
    maxMemoryMb: number;
    maxApps: number;
    maxStorageMb: number;
  };
};

type MetricCardProps = {
  label: string;
  current: number;
  total: number;
  suffix: string;
  decimals?: number;
};

function MetricCard({ label, current, total, suffix, decimals = 0 }: MetricCardProps) {
  const utilization = total > 0 ? Math.min(current / total, 1) : 0;
  const isCritical = utilization >= 0.9;
  const percentage = Math.round(utilization * 100);
  const accentClass = isCritical ? 'bg-rose-500' : 'bg-accent';

  return (
    <div className="space-y-2 rounded-gf-2xl border border-brand-700/50 bg-brand-900/80 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <p className={`text-xs font-medium ${isCritical ? 'text-rose-300' : 'text-zinc-500'}`}>
          {current.toFixed(decimals)} / {total.toFixed(decimals)} {suffix}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-700/60">
        <div className={`h-full rounded-full transition-all ${accentClass}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className={`text-[11px] uppercase tracking-[0.22em] ${isCritical ? 'text-rose-300' : 'text-zinc-500'}`}>
        {percentage}% used
      </p>
    </div>
  );
}

export function QuotaWidget() {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const title = useMemo(() => (user ? `${user.displayName}'s quota` : 'Cluster quota'), [user]);

  useEffect(() => {
    if (!hasHydrated || !user) {
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMessage(null);

    api
      .get<QuotaSummary>(`/users/${user.id}/quota`)
      .then((response) => {
        if (!active) {
          return;
        }
        setQuota(response.data);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load quota data.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, user]);

  return (
    <aside className="w-[340px] max-w-[calc(100vw-3rem)] rounded-[1.5rem] border border-brand-700/50 bg-brand-900/90 p-4 text-zinc-100 shadow-panel backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Resource Quota</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h2>
        </div>
        <span className="rounded-full border border-brand-600 bg-brand-800 px-2.5 py-1 text-[11px] font-medium text-brand-200">
          Live
        </span>
      </div>

      {!hasHydrated ? (
        <div className="rounded-gf-2xl border border-brand-700/50 bg-brand-900/80 p-4 text-sm text-zinc-500">Hydrating session…</div>
      ) : null}

      {hasHydrated && !user ? (
        <div className="rounded-gf-2xl border border-brand-700/50 bg-brand-900/80 p-4 text-sm text-zinc-500">Sign in to see usage limits.</div>
      ) : null}

      {loading ? <div className="rounded-gf-2xl border border-brand-700/50 bg-brand-900/80 p-4 text-sm text-zinc-500">Loading quota…</div> : null}
      {errorMessage ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{errorMessage}</div> : null}

      {quota ? (
        <div className="space-y-3">
          <MetricCard label="CPU" current={quota.usage.currentCpu} total={quota.quota.maxCpu} suffix="Cores" decimals={1} />
          <MetricCard label="Memory" current={quota.usage.currentMemoryMb} total={quota.quota.maxMemoryMb} suffix="MB" />
          <MetricCard label="Apps" current={quota.usage.currentApps} total={quota.quota.maxApps} suffix="Apps" />
          <MetricCard label="Storage" current={quota.usage.currentStorageMb} total={quota.quota.maxStorageMb} suffix="MB" />
        </div>
      ) : null}
    </aside>
  );
}
