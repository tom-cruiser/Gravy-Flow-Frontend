'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import type { DomainRecord } from '@/lib/domainApi';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context); the
      // value is still visible and selectable, so this is a silent no-op —
      // same convention as RightDrawer.tsx's handleCopyUrl.
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 break-all">
        <span className="text-amber-400">{label}:</span> <span className="text-amber-100">{value}</span>
      </p>
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label}`}
        className="shrink-0 rounded-md p-1 text-amber-400 transition hover:bg-amber-500/10 hover:text-amber-200"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// Shown inline under a DomainCard whose domain isn't fully routable yet.
// Two distinct stages, both real backend-computed values (no invented
// placeholders): ownership (TXT challenge, from VerifyDeploymentDomain) and,
// once ownership is proven, reachability (CNAME/A target, from
// checkDNSTarget's statusMessage — see domain_handlers.go).
export function DnsInstructionsPanel({ domain }: { domain: DomainRecord }) {
  const challengeName = `_acme-challenge.${domain.customDomain}`;

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2 text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">{domain.verified ? 'DNS not pointed here yet' : 'Prove you own this domain'}</span>
      </div>

      {!domain.verified ? (
        <div className="space-y-2 rounded-lg bg-amber-950/30 p-3 font-mono text-xs leading-6">
          <p className="text-amber-200">Create this TXT record, then click Re-verify:</p>
          <CopyRow label="Type" value="TXT" />
          <CopyRow label="Name" value={challengeName} />
          {domain.verificationToken ? <CopyRow label="Value" value={domain.verificationToken} /> : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-lg bg-amber-950/30 p-3 font-mono text-xs leading-6">
          <p className="text-amber-200">Ownership verified. Point traffic here to finish:</p>
          <p className="break-all text-amber-100">
            {domain.statusMessage || 'DNS does not currently point to this platform yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
