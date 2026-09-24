'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  addDomain,
  deleteDomain,
  domainErrorMessage,
  getEdgeSettings,
  listDomains,
  makeDomainPrimary,
  updateEdgeSettings,
  verifyDomain,
  type DomainRecord,
  type EdgeSettings,
  type WWWRedirectMode,
} from '@/lib/domainApi';
import { toast } from '@/store/toastStore';
import { DomainCard } from './DomainCard';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DomainManagerProps = {
  deploymentId: string | null;
};

function toggleInSet(set: Set<string>, key: string, present: boolean): Set<string> {
  const next = new Set(set);
  if (present) next.add(key);
  else next.delete(key);
  return next;
}

export function DomainManager({ deploymentId }: DomainManagerProps) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [customDomain, setCustomDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // One flag per domain per action, instead of a single shared string —
  // verifying domain A and deleting domain B used to fight over one loading
  // flag, so re-enabling A's button also silently cleared B's spinner.
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());
  const [deletingDomains, setDeletingDomains] = useState<Set<string>>(new Set());
  const [settingPrimaryDomains, setSettingPrimaryDomains] = useState<Set<string>>(new Set());

  const [edgeSettings, setEdgeSettings] = useState<EdgeSettings | null>(null);
  const [savingEdgeSettings, setSavingEdgeSettings] = useState(false);

  // Bumped every time the selected service changes, so a request started
  // for the previous service can recognize it's stale and skip applying its
  // result — without this, switching services mid-request could splice the
  // old service's domain into the new one's list.
  const generationRef = useRef(0);

  const title = useMemo(() => (deploymentId ? `Domains for ${deploymentId}` : 'Domains'), [deploymentId]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    setCustomDomain('');
    setErrorMessage(null);
    setVerifyingDomains(new Set());
    setDeletingDomains(new Set());
    setSettingPrimaryDomains(new Set());
    setEdgeSettings(null);

    if (!deploymentId) {
      setDomains([]);
      return;
    }

    setLoading(true);
    Promise.all([listDomains(deploymentId), getEdgeSettings(deploymentId)])
      .then(([domainsResult, edgeSettingsResult]) => {
        if (generation !== generationRef.current) return;
        setDomains(domainsResult.domains ?? []);
        setEdgeSettings(edgeSettingsResult);
      })
      .catch((error) => {
        if (generation !== generationRef.current) return;
        setErrorMessage(domainErrorMessage(error, 'Failed to load domains.'));
      })
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  }, [deploymentId]);

  const handleRefresh = () => {
    if (!deploymentId) return;
    const generation = generationRef.current;
    setLoading(true);
    setErrorMessage(null);
    listDomains(deploymentId)
      .then((result) => {
        if (generation !== generationRef.current) return;
        setDomains(result.domains ?? []);
      })
      .catch((error) => {
        if (generation !== generationRef.current) return;
        setErrorMessage(domainErrorMessage(error, 'Failed to refresh domains.'));
      })
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  };

  const handleAddDomain = async () => {
    const trimmed = customDomain.trim();
    if (!deploymentId || !trimmed) {
      setErrorMessage('Please enter a valid domain name.');
      return;
    }

    const generation = generationRef.current;
    setAddingDomain(true);
    setErrorMessage(null);

    try {
      const result = await addDomain(deploymentId, trimmed);
      if (generation !== generationRef.current) return;

      setDomains((current) => {
        const filtered = current.filter((entry) => entry.customDomain !== result.domain.customDomain);
        return [...filtered, result.domain].sort((a, b) => a.customDomain.localeCompare(b.customDomain));
      });
      setCustomDomain('');
      toast.success(`Added ${trimmed}. Follow the DNS instructions to finish setup.`, 'Domain added');
    } catch (error) {
      if (generation !== generationRef.current) return;
      setErrorMessage(domainErrorMessage(error, 'Failed to add domain.'));
    } finally {
      if (generation === generationRef.current) setAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domain: string) => {
    if (!deploymentId) return;
    const generation = generationRef.current;
    setVerifyingDomains((current) => toggleInSet(current, domain, true));

    try {
      const result = await verifyDomain(deploymentId, domain);
      if (generation !== generationRef.current) return;
      setDomains((current) => current.map((entry) => (entry.customDomain === result.domain.customDomain ? result.domain : entry)));
      if (result.domain.status === 'active' || result.domain.status === 'ssl_provisioning') {
        toast.success(`${domain} is now ${result.domain.status === 'active' ? 'live' : 'provisioning SSL'}.`, 'Domain verified');
      } else {
        toast.info(result.domain.statusMessage || 'DNS is not fully configured yet.', domain);
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      toast.error(domainErrorMessage(error, 'Failed to verify domain.'), domain);
    } finally {
      if (generation === generationRef.current) {
        setVerifyingDomains((current) => toggleInSet(current, domain, false));
      }
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!deploymentId) return;
    const generation = generationRef.current;
    setDeletingDomains((current) => toggleInSet(current, domain, true));

    try {
      await deleteDomain(deploymentId, domain);
      if (generation !== generationRef.current) return;
      setDomains((current) => current.filter((entry) => entry.customDomain !== domain));
      toast.success(`Deleted ${domain}.`, 'Domain removed');
    } catch (error) {
      if (generation !== generationRef.current) return;
      toast.error(domainErrorMessage(error, 'Failed to delete domain.'), domain);
    } finally {
      if (generation === generationRef.current) {
        setDeletingDomains((current) => toggleInSet(current, domain, false));
      }
    }
  };

  const handleMakePrimary = async (domain: string) => {
    if (!deploymentId) return;
    const generation = generationRef.current;
    setSettingPrimaryDomains((current) => toggleInSet(current, domain, true));

    try {
      const updated = await makeDomainPrimary(deploymentId, domain);
      if (generation !== generationRef.current) return;
      setDomains((current) => current.map((entry) => ({ ...entry, isPrimary: entry.customDomain === updated.customDomain })));
      toast.success(`${domain} is now the primary domain.`, 'Primary domain updated');
    } catch (error) {
      if (generation !== generationRef.current) return;
      toast.error(domainErrorMessage(error, 'Failed to set primary domain.'), domain);
    } finally {
      if (generation === generationRef.current) {
        setSettingPrimaryDomains((current) => toggleInSet(current, domain, false));
      }
    }
  };

  const handleEdgeSettingsChange = async (next: EdgeSettings) => {
    if (!deploymentId) return;
    const generation = generationRef.current;
    const previous = edgeSettings;
    setEdgeSettings(next);
    setSavingEdgeSettings(true);

    try {
      const saved = await updateEdgeSettings(deploymentId, next);
      if (generation !== generationRef.current) return;
      setEdgeSettings(saved);
    } catch (error) {
      if (generation !== generationRef.current) return;
      setEdgeSettings(previous);
      toast.error(domainErrorMessage(error, 'Failed to update edge settings.'), 'Edge settings');
    } finally {
      if (generation === generationRef.current) setSavingEdgeSettings(false);
    }
  };

  const hasPrimaryDomain = domains.some((d) => d.isPrimary);

  return (
    <div className="rounded-2xl border border-brand-700 bg-brand-900/90 p-4 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Custom Domains</h2>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{title}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-brand-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-brand-500 hover:bg-brand-750 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && domains.length === 0 ? (
        <div className="mb-3 rounded-2xl border border-brand-700 bg-brand-900/80 p-4 text-sm text-zinc-500">Loading domains…</div>
      ) : null}
      {errorMessage ? (
        <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{errorMessage}</div>
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
          className="inline-flex items-center gap-2 rounded-gf-2xl border border-brand-600 bg-brand-100 px-4 py-3 text-sm font-medium text-brand-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {addingDomain ? 'Adding…' : 'Add'}
        </button>
      </div>

      {domains.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-brand-600 bg-brand-900/50 p-6 text-center">
          <p className="text-sm text-zinc-400">No domains configured yet</p>
          <p className="mt-1 text-xs text-zinc-500">Add a custom domain to connect to your service</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              isVerifying={verifyingDomains.has(domain.customDomain)}
              isDeleting={deletingDomains.has(domain.customDomain)}
              isSettingPrimary={settingPrimaryDomains.has(domain.customDomain)}
              onVerify={() => handleVerifyDomain(domain.customDomain)}
              onDelete={() => handleDeleteDomain(domain.customDomain)}
              onMakePrimary={() => handleMakePrimary(domain.customDomain)}
            />
          ))}
        </div>
      )}

      {edgeSettings && hasPrimaryDomain ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-brand-700 bg-brand-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Edge settings</p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-200">Force HTTPS</p>
              <p className="text-xs text-zinc-500">Redirect all HTTP traffic to HTTPS for this service.</p>
            </div>
            <Switch
              checked={edgeSettings.forceHttps}
              disabled={savingEdgeSettings}
              onCheckedChange={(checked) => handleEdgeSettingsChange({ ...edgeSettings, forceHttps: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-200">www redirect</p>
              <p className="text-xs text-zinc-500">Redirect between the primary domain and its www subdomain.</p>
            </div>
            <Select
              value={edgeSettings.wwwRedirectMode}
              onValueChange={(value) => handleEdgeSettingsChange({ ...edgeSettings, wwwRedirectMode: value as WWWRedirectMode })}
            >
              <SelectTrigger className="w-44" disabled={savingEdgeSettings}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No redirect</SelectItem>
                <SelectItem value="apex_to_www">apex → www</SelectItem>
                <SelectItem value="www_to_apex">www → apex</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Dynamic SSL mapping via Caddy control plane</p>
    </div>
  );
}
