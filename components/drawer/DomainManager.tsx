'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

type DomainRecord = {
  id: string;
  deploymentId: string;
  projectId: string;
  customDomain: string;
  verified: boolean;
  verificationToken?: string;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DomainListResponse = {
  domains: DomainRecord[];
  count: number;
};

type DomainManagerProps = {
  deploymentId: string | null;
};

export function DomainManager({ deploymentId }: DomainManagerProps) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [customDomain, setCustomDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
  const [challengeMap, setChallengeMap] = useState<Record<string, { challenge: string; instruction: string }>>({});

  const title = useMemo(() => (deploymentId ? `Domains for ${deploymentId}` : 'Domains'), [deploymentId]);

  useEffect(() => {
    if (!deploymentId) {
      setDomains([]);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMessage(null);

    api
      .get<DomainListResponse>(`/apps/${deploymentId}/domains`)
      .then((response) => {
        if (!active) return;
        setDomains(response.data.domains ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load domains.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deploymentId]);

  const handleAddDomain = async () => {
    if (!deploymentId || !customDomain.trim()) {
      setErrorMessage('Please enter a valid domain name.');
      return;
    }

    setAddingDomain(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await api.post(`/apps/${deploymentId}/domains`, {
        customDomain: customDomain.trim(),
      });

      const nextDomain = response.data?.domain as DomainRecord | undefined;
      if (nextDomain) {
        setDomains((current) => {
          const filtered = current.filter((entry) => entry.customDomain !== nextDomain.customDomain);
          return [...filtered, nextDomain].sort((a, b) => a.customDomain.localeCompare(b.customDomain));
        });

        if (response.status === 202) {
          setChallengeMap((current) => ({
            ...current,
            [nextDomain.customDomain]: {
              challenge: response.data?.challenge ?? `_gravyflow-verify.${nextDomain.customDomain}`,
              instruction: response.data?.instruction ?? `Point a CNAME record to proxy.gravyflow.dev`,
            },
          }));
        }

        setCustomDomain('');
        setSuccessMessage(`✓ Added domain ${customDomain.trim()}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to add domain.');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domain: string) => {
    if (!deploymentId) return;

    setVerifyingDomain(domain);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await api.post(`/apps/${deploymentId}/domains/${encodeURIComponent(domain)}/verify`);
      const nextDomain = response.data?.domain as DomainRecord | undefined;
      if (nextDomain) {
        setDomains((current) =>
          current.map((entry) => (entry.customDomain === nextDomain.customDomain ? nextDomain : entry))
        );
        setSuccessMessage(`✓ Domain ${domain} verified successfully`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to verify domain.');
    } finally {
      setVerifyingDomain(null);
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!deploymentId) return;

    setDeletingDomain(domain);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.delete(`/apps/${deploymentId}/domains/${encodeURIComponent(domain)}`);
      setDomains((current) => current.filter((entry) => entry.customDomain !== domain));
      setSuccessMessage(`✓ Deleted domain ${domain}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete domain.');
    } finally {
      setDeletingDomain(null);
    }
  };

  const handleRefreshDomains = async () => {
    if (!deploymentId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.get<DomainListResponse>(`/apps/${deploymentId}/domains`);
      setDomains(response.data.domains ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh domains.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-700 bg-brand-900/90 p-4 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Custom Domains</h2>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{title}</p>
        </div>
        <button
          type="button"
          onClick={handleRefreshDomains}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-brand-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-brand-500 hover:bg-brand-750 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && domains.length === 0 ? (
        <div className="mb-3 rounded-2xl border border-brand-700 bg-brand-900/80 p-4 text-sm text-zinc-500">
          Loading domains…
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="mb-3 animate-in fade-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      <div className="mb-4 flex gap-2">
        <input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
          placeholder="app.example.com"
          className="min-w-0 flex-1 rounded-gf-2xl border border-brand-700/50 bg-brand-900/80 px-4 py-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
        />
        <button
          type="button"
          onClick={handleAddDomain}
          disabled={addingDomain || !deploymentId}
          className="inline-flex items-center gap-2 rounded-gf-2xl border border-brand-600 bg-brand-100 px-4 py-3 text-sm font-medium text-brand-950 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {addingDomain ? 'Adding…' : 'Add'}
        </button>
      </div>

      {domains.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-brand-600 bg-brand-900/50 p-6 text-center">
          <p className="text-sm text-zinc-400">No domains configured yet</p>
          <p className="text-xs text-zinc-500 mt-1">Add a custom domain to connect to your service</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => {
            const challenge = challengeMap[domain.customDomain];
            const isVerifying = verifyingDomain === domain.customDomain;
            const isDeleting = deletingDomain === domain.customDomain;

            return (
              <div key={domain.id} className="rounded-2xl border border-brand-700 bg-brand-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-medium text-zinc-100">{domain.customDomain}</p>
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${domain.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {domain.verified ? '✓ Verified' : '⚠ Pending verification'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!domain.verified ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyDomain(domain.customDomain)}
                        disabled={isVerifying}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ShieldCheck className={`h-3.5 w-3.5 ${isVerifying ? 'animate-pulse' : ''}`} />
                        {isVerifying ? 'Verifying…' : 'Verify Domain'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteDomain(domain.customDomain)}
                      disabled={isDeleting}
                      className="rounded-full border border-brand-700 bg-brand-800 px-3 py-1.5 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete domain"
                    >
                      <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </div>

                {!domain.verified ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="mb-3 flex items-center gap-2 text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">DNS Challenge Required</span>
                    </div>
                    <div className="space-y-2 font-mono text-xs leading-6 text-amber-100 bg-amber-950/30 rounded-lg p-3">
                      <p className="text-amber-200">Point a CNAME record to proxy.gravyflow.dev</p>
                      <div className="border-t border-amber-500/20 pt-2 mt-2">
                        <p className="break-all">
                          <span className="text-amber-400">Challenge:</span> {challenge?.challenge ?? `_gravyflow-verify.${domain.customDomain}`}
                        </p>
                        <p className="mt-1 break-all">
                          <span className="text-amber-400">Instruction:</span> {challenge?.instruction ?? 'Create the record, wait for DNS propagation, then verify.'}
                        </p>
                        {domain.verificationToken ? (
                          <p className="mt-1 break-all">
                            <span className="text-amber-400">Token:</span> {domain.verificationToken}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    Verified at {domain.verifiedAt ? new Date(domain.verifiedAt).toLocaleDateString() : 'unknown date'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Dynamic SSL mapping via Caddy control plane</p>
    </div>
  );
}
