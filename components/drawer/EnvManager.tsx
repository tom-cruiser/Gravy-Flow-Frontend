'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

type EnvItem = {
  key: string;
  value: string;
};

type EnvManagerProps = {
  deploymentId: string | null;
};

type EnvListResponse = {
  envVars: EnvItem[];
  count: number;
};

const maskedValue = '••••••';

export function EnvManager({ deploymentId }: EnvManagerProps) {
  const [envItems, setEnvItems] = useState<EnvItem[]>([]);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const title = useMemo(() => {
    return deploymentId ? `Secrets for ${deploymentId}` : 'Secrets';
  }, [deploymentId]);

  useEffect(() => {
    // Switching the selected node should not leave behind a half-typed draft,
    // or stale success/error messages, from whatever was previously selected.
    setDraftKey('');
    setDraftValue('');
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!deploymentId) {
      setEnvItems([]);
      return;
    }

    let active = true;
    setLoading(true);

    api
      .get<EnvListResponse>(`/apps/${deploymentId}/env`)
      .then((response) => {
        if (!active) return;
        setEnvItems(response.data.envVars ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load environment variables.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deploymentId]);

  const handleAddRow = async () => {
    if (!deploymentId) return;

    const key = draftKey.trim();
    const value = draftValue.trim();
    if (!key || !value) {
      setErrorMessage('A key and value are required before saving.');
      return;
    }

    setAddingRow(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.post(`/apps/${deploymentId}/env`, { key, value });
      setEnvItems((current) => [...current.filter((i) => i.key !== key), { key, value: maskedValue }]);
      setDraftKey('');
      setDraftValue('');
      setSuccessMessage(`✓ Added ${key} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to add environment variable.');
    } finally {
      setAddingRow(false);
    }
  };

  const handleDeleteRow = async (key: string) => {
    if (!deploymentId) return;

    setDeletingKey(key);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.delete(`/apps/${deploymentId}/env/${encodeURIComponent(key)}`);
      setEnvItems((current) => current.filter((item) => item.key !== key));
      setSuccessMessage(`✓ Deleted ${key}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete environment variable.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleRestartAndApply = async () => {
    if (!deploymentId) return;

    setRestarting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.post(`/apps/${deploymentId}/restart`);
      setSuccessMessage('✓ Service restarted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to restart service.');
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="rounded-gf-2xl border border-brand-700/50 bg-brand-900/90 p-4 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Environment Variables</h2>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{title}</p>
        </div>
      </div>

      {loading ? (
        <div className="mb-3 rounded-2xl border border-brand-700 bg-brand-900/80 p-4 text-sm text-zinc-500">
          Loading environment variables…
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAddRow}
          disabled={addingRow || !deploymentId}
          className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          {addingRow ? 'Adding…' : 'Add Row'}
        </button>
        <button
          type="button"
          onClick={handleRestartAndApply}
          disabled={restarting || !deploymentId}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-brand-200 transition hover:bg-accent/15 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
          {restarting ? 'Restarting…' : 'Restart & Apply Changes'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-700">
        <div className="grid grid-cols-[1.2fr_1.8fr_auto] border-b border-brand-700 bg-brand-850/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span className="font-mono">Key</span>
          <span className="font-mono">Value</span>
          <span className="font-mono">Actions</span>
        </div>
        <div className="divide-y divide-brand-700/50">
          <div className="grid grid-cols-[1.2fr_1.8fr_auto] gap-2 bg-brand-900/50 px-4 py-3">
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
              placeholder="NEW_SECRET"
              className="min-w-0 rounded-xl border border-dashed border-brand-600 bg-brand-900/80 px-3 py-2 text-sm font-mono text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
            />
            <input
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
              placeholder="••••••"
              type="password"
              className="min-w-0 rounded-xl border border-dashed border-brand-600 bg-brand-900/80 px-3 py-2 text-sm font-mono text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
            />
            <button
              type="button"
              onClick={handleAddRow}
              disabled={addingRow}
              className="rounded-xl border border-brand-700 bg-brand-900/80 px-3 py-2 text-zinc-100 transition hover:border-brand-600 hover:bg-brand-850 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Add environment variable"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {envItems.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-zinc-400">No environment variables yet</p>
              <p className="mt-1 text-xs text-zinc-500">Add a key and value above, then restart to apply.</p>
            </div>
          ) : null}

          {envItems.map((item, index) => (
            <div key={`${item.key}-${index}`} className="grid grid-cols-[1.2fr_1.8fr_auto] gap-2 px-4 py-3">
              <div className="min-w-0 truncate rounded-xl border border-brand-700 bg-brand-900/80 px-3 py-2 font-mono text-sm text-zinc-100" title={item.key}>
                {item.key}
              </div>
              <div className="min-w-0 truncate rounded-xl border border-brand-700 bg-brand-900/80 px-3 py-2 font-mono text-sm text-zinc-100">
                {maskedValue}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRow(item.key)}
                disabled={deletingKey === item.key}
                className="rounded-xl border border-brand-700 bg-brand-900/80 px-3 py-2 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Delete environment variable"
              >
                <Trash2 className={`h-4 w-4 ${deletingKey === item.key ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Encrypted at rest via Go control plane</p>
    </div>
  );
}
