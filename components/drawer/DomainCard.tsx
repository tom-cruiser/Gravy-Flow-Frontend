'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DnsInstructionsPanel } from './DnsInstructionsPanel';
import type { DomainRecord, DomainStatus } from '@/lib/domainApi';

const STATUS_VARIANT: Record<DomainStatus, 'success' | 'warning' | 'destructive'> = {
  pending_dns: 'warning',
  dns_verified: 'warning',
  ssl_provisioning: 'warning',
  active: 'success',
  error: 'destructive',
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  pending_dns: 'Pending DNS',
  dns_verified: 'DNS verified',
  ssl_provisioning: 'Provisioning SSL',
  active: 'Active',
  error: 'Error',
};

type DomainCardProps = {
  domain: DomainRecord;
  isVerifying: boolean;
  isDeleting: boolean;
  isSettingPrimary: boolean;
  onVerify: () => void;
  onDelete: () => void;
  onMakePrimary: () => void;
};

export function DomainCard({ domain, isVerifying, isDeleting, isSettingPrimary, onVerify, onDelete, onMakePrimary }: DomainCardProps) {
  const [copied, setCopied] = useState(false);
  const pulsing = domain.status === 'pending_dns' || domain.status === 'ssl_provisioning';
  const showInstructions = domain.status !== 'active' && domain.status !== 'ssl_provisioning';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${domain.customDomain}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Same silent-no-op convention as RightDrawer.tsx's handleCopyUrl.
    }
  };

  return (
    <div className="rounded-2xl border border-brand-700 bg-brand-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm font-medium text-zinc-100">{domain.customDomain}</p>
            {domain.isPrimary && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" aria-label="Primary domain" />
            )}
          </div>
          <Badge variant={STATUS_VARIANT[domain.status]} className={`mt-1.5 ${pulsing ? 'animate-pulse' : ''}`}>
            {STATUS_LABEL[domain.status] ?? domain.status}
          </Badge>
          {domain.status === 'error' && domain.statusMessage ? (
            <p className="mt-1 text-xs text-rose-300">{domain.statusMessage}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy URL"
            className="rounded-full border border-brand-700 bg-brand-800 p-1.5 text-zinc-400 transition hover:border-brand-500 hover:text-zinc-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {!domain.isPrimary && domain.status === 'active' ? (
            <button
              type="button"
              onClick={onMakePrimary}
              disabled={isSettingPrimary}
              title="Make primary"
              className="rounded-full border border-brand-700 bg-brand-800 p-1.5 text-zinc-400 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Star className={`h-3.5 w-3.5 ${isSettingPrimary ? 'animate-pulse' : ''}`} />
            </button>
          ) : null}

          {domain.status !== 'active' ? (
            <button
              type="button"
              onClick={onVerify}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isVerifying ? 'Verifying…' : 'Re-verify'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete domain"
            className="rounded-full border border-brand-700 bg-brand-800 p-1.5 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>

      {showInstructions ? <DnsInstructionsPanel domain={domain} /> : null}
    </div>
  );
}
