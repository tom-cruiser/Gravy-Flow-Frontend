'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, FileUp, Hammer, Plus, RefreshCcw, Trash2, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCanvasStore } from '@/store/canvasStore';
import { toast } from '@/store/toastStore';
import {
  ENV_FILE_MAX_BYTES,
  buildEnvEntry,
  chunk,
  markDuplicates,
  parseEnvFile,
  validateEnvKey,
  type EnvEntryStatus,
  type ParsedEnvEntry,
} from '@/lib/envFile';
import type { NodeStatus } from '@/store/canvasStore';

type EnvItem = {
  key: string;
  value: string;
};

type EnvManagerProps = {
  deploymentId: string | null;
  serviceName?: string | null;
  nodeStatus?: NodeStatus | null;
};

type EnvListResponse = {
  envVars: EnvItem[];
  count: number;
};

type BulkResult = {
  key: string;
  status: 'saved' | 'skipped' | 'error';
  reason?: string;
  error?: string;
};

type BulkResponse = {
  results: BulkResult[];
  count: number;
};

type ImportSummary = {
  saved: number;
  skipped: number;
  failed: number;
  failures: BulkResult[];
};

type DeployResponse = {
  jobId?: string;
  message?: string;
};

// A row in the import preview needs a stable identity that survives the key
// itself being edited (or briefly colliding with another row mid-edit), so
// it carries its own id separate from ParsedEnvEntry's key/originalKey.
type StagedEntry = ParsedEnvEntry & { id: string };

let stagedEntryIdCounter = 0;
function nextStagedEntryId(): string {
  stagedEntryIdCounter += 1;
  return `staged-${stagedEntryIdCounter}`;
}

function withStagedIds(entries: ParsedEnvEntry[]): StagedEntry[] {
  return entries.map((entry) => ({ ...entry, id: nextStagedEntryId() }));
}

/** A row the user hasn't typed anything into yet — shown neutrally rather than as an error. */
function isBlankStagedEntry(entry: StagedEntry): boolean {
  return entry.originalKey.trim() === '' && entry.value === '';
}

const maskedValue = '••••••';

// The bulk endpoint caps a single request at 50 variables, so a larger file is
// submitted as several sequential batches.
const BULK_BATCH_SIZE = 50;

const statusStyles: Record<EnvEntryStatus, { label: string; className: string }> = {
  ok: { label: 'new', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
  adapted: { label: 'adapted', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  duplicate: { label: 'duplicate', className: 'border-zinc-600 bg-zinc-700/30 text-zinc-400' },
  invalid: { label: 'skipped', className: 'border-rose-500/30 bg-rose-500/10 text-rose-200' },
};

function describeError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as {
      response?: { data?: { error?: string; details?: string; validation?: { errors?: string[] } } };
    }).response?.data;
    if (data?.validation?.errors?.length) return data.validation.errors.join(' ');
    if (data?.details) return data.details;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : fallback;
}

export function EnvManager({ deploymentId, serviceName, nodeStatus }: EnvManagerProps) {
  const markNodeDeployQueued = useCanvasStore((state) => state.markNodeDeployQueued);
  const setDrawerTab = useCanvasStore((state) => state.setDrawerTab);

  const [envItems, setEnvItems] = useState<EnvItem[]>([]);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [importing, setImporting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The editable staging table shown once a file/paste has been parsed.
  // Seeded from importText (see the effect below) but edited independently
  // of it from then on — typing in a row here doesn't touch importText, so
  // it won't get re-parsed out from under you.
  const [stagedEntries, setStagedEntries] = useState<StagedEntry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // The saved-variables list is capped to a fixed height (see the scroll
  // container below) so a long list can't push the Add Row / Import
  // controls off screen. These track that scroll region so a newly added
  // variable is actually visible instead of landing off the bottom edge.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    setHasOverflow(el.scrollHeight - el.clientHeight > 4);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  }, []);

  // Re-check after every list change (add/delete/import/resize) — a row
  // being added or removed can flip whether the list actually overflows.
  useEffect(() => {
    updateScrollState();
  }, [envItems, updateScrollState]);

  const scrollListToBottom = useCallback(() => {
    listScrollRef.current?.scrollTo({ top: listScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // When a variable is added, scroll it into view and flash it briefly so
  // it doesn't just silently appear below the fold.
  useEffect(() => {
    if (!highlightKey) return;
    rowRefs.current.get(highlightKey)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const timeout = setTimeout(() => setHighlightKey(null), 1600);
    return () => clearTimeout(timeout);
  }, [highlightKey]);

  const title = useMemo(() => {
    return deploymentId ? `Secrets for ${deploymentId}` : 'Secrets';
  }, [deploymentId]);

  // Re-seed the staging table whenever the raw text changes (paste, file
  // load, or a manual edit in the textarea) — this is the one point where
  // per-row edits made below get discarded in favour of re-parsing the new
  // source. Editing a row's own key/value inputs never touches importText,
  // so those edits survive every other render.
  useEffect(() => {
    if (importText.trim() === '') {
      setStagedEntries([]);
      return;
    }
    setStagedEntries(withStagedIds(parseEnvFile(importText).entries));
  }, [importText]);

  const importableStaged = useMemo(
    () => stagedEntries.filter((entry) => entry.status === 'ok' || entry.status === 'adapted'),
    [stagedEntries],
  );

  const stagedCounts = useMemo(() => {
    const counts: Record<EnvEntryStatus, number> = { ok: 0, adapted: 0, duplicate: 0, invalid: 0 };
    stagedEntries.forEach((entry) => {
      if (isBlankStagedEntry(entry)) return; // an empty draft row isn't a countable outcome yet
      counts[entry.status] += 1;
    });
    return counts;
  }, [stagedEntries]);

  const updateStagedEntry = useCallback((id: string, patch: Partial<{ key: string; value: string }>) => {
    setStagedEntries((current) => {
      const next = current.map((entry) => {
        if (entry.id !== id) return entry;
        const rawKey = patch.key ?? entry.originalKey;
        const value = patch.value ?? entry.value;
        return { ...buildEnvEntry(rawKey, value, entry.line), id: entry.id };
      });
      return markDuplicates(next) as StagedEntry[];
    });
  }, []);

  const removeStagedEntry = useCallback((id: string) => {
    setStagedEntries((current) => markDuplicates(current.filter((entry) => entry.id !== id)) as StagedEntry[]);
    setRevealedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const addStagedEntry = useCallback(() => {
    const id = nextStagedEntryId();
    setStagedEntries((current) => [...current, { ...buildEnvEntry('', ''), id }]);
    setRevealedIds((current) => new Set(current).add(id));
  }, []);

  const toggleRevealed = useCallback((id: string) => {
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const existingKeys = useMemo(() => new Set(envItems.map((item) => item.key)), [envItems]);

  const refreshEnv = useCallback(async (id: string) => {
    const response = await api.get<EnvListResponse>(`/apps/${id}/env`);
    setEnvItems(response.data.envVars ?? []);
  }, []);

  const resetImport = useCallback(() => {
    setImportText(''); // also clears stagedEntries via the seeding effect above
    setImportFileName(null);
    setImportSummary(null);
    setDragActive(false);
    setRevealedIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    // Switching the selected node should not leave behind a half-typed draft,
    // a staged .env import, or stale success/error messages, from whatever was
    // previously selected.
    setDraftKey('');
    setDraftValue('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setImportOpen(false);
    resetImport();

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
        setErrorMessage(describeError(error, 'Failed to load environment variables.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deploymentId, resetImport]);

  const handleAddRow = async () => {
    if (!deploymentId) return;

    const rawKey = draftKey.trim();
    const value = draftValue.trim();
    if (!rawKey || !value) {
      setErrorMessage('A key and value are required before saving.');
      return;
    }

    // Mirror the Import .env path: fold dashes/dots/spaces to underscores,
    // strip anything else invalid, and uppercase — instead of sending the
    // raw text and letting the backend reject it outright.
    const { key, valid } = validateEnvKey(rawKey);
    if (!valid) {
      setErrorMessage(`"${rawKey}" can't be turned into a valid key — use letters, digits, and underscores.`);
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
      setHighlightKey(key);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(describeError(error, 'Failed to add environment variable.'));
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
      setErrorMessage(describeError(error, 'Failed to delete environment variable.'));
    } finally {
      setDeletingKey(null);
    }
  };

  // A service that never finished its first build (or whose deployment is
  // stuck FAILED with no running container) has nothing to "restart" — the
  // /restart endpoint's guard rejects it indefinitely. Route those cases
  // through /deploy instead, exactly like ServiceActionBar's isRedeploy check.
  const needsRedeploy = nodeStatus !== 'RUNNING';

  const handleRestartAndApply = async () => {
    if (!deploymentId) return;

    setRestarting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const endpoint = needsRedeploy ? `/apps/${deploymentId}/deploy` : `/apps/${deploymentId}/restart`;
      const response = await api.post<DeployResponse>(endpoint);
      if (needsRedeploy) {
        markNodeDeployQueued(deploymentId, response.data?.jobId ?? null);
        setDrawerTab('logs');
        setSuccessMessage('✓ Redeploy queued — watch the Logs tab for progress.');
      } else {
        setSuccessMessage('✓ Service restarted successfully');
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(describeError(error, needsRedeploy ? 'Failed to queue redeploy.' : 'Failed to restart service.'));
    } finally {
      setRestarting(false);
    }
  };

  const loadFile = useCallback(async (file: File) => {
    setErrorMessage(null);
    setImportSummary(null);

    if (file.size > ENV_FILE_MAX_BYTES) {
      setErrorMessage(`${file.name} is larger than ${Math.round(ENV_FILE_MAX_BYTES / 1024)} KB.`);
      return;
    }

    try {
      const text = await file.text();
      setImportText(text);
      setImportFileName(file.name);
      setImportOpen(true);
    } catch (error) {
      setErrorMessage(describeError(error, `Failed to read ${file.name}.`));
    }
  }, []);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  // Shared by both "Save" and "Save & Rebuild" below — batches importableStaged
  // to the bulk endpoint and returns the outcome. Batched sequentially rather
  // than in parallel: the batches upsert into the same deployment, and a
  // partial failure is easier to report when they land in a known order.
  const saveStagedBatch = async (id: string): Promise<ImportSummary> => {
    const summary: ImportSummary = { saved: 0, skipped: 0, failed: 0, failures: [] };

    for (const batch of chunk(importableStaged, BULK_BATCH_SIZE)) {
      const response = await api.post<BulkResponse>(`/apps/${id}/env/bulk`, {
        variables: batch.map((entry) => ({ key: entry.key, value: entry.value })),
        overwrite,
      });

      for (const result of response.data.results ?? []) {
        if (result.status === 'saved') summary.saved += 1;
        else if (result.status === 'skipped') summary.skipped += 1;
        else {
          summary.failed += 1;
          summary.failures.push(result);
        }
      }
    }

    return summary;
  };

  const handleApplyImport = async () => {
    if (!deploymentId || importableStaged.length === 0) return;

    setImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const summary = await saveStagedBatch(deploymentId);
      setImportSummary(summary);

      if (summary.saved > 0) {
        await refreshEnv(deploymentId).catch(() => {
          // The import itself succeeded; a failed refresh should not be
          // reported as an import failure. Restart & Apply reloads it anyway.
        });
        setSuccessMessage(
          `✓ Imported ${summary.saved} variable${summary.saved === 1 ? '' : 's'}. Restart to apply.`,
        );
        // The saved list has its own scroll region below the import panel —
        // jump it to the bottom so the just-imported variables are actually
        // visible instead of requiring the user to go find them.
        requestAnimationFrame(scrollListToBottom);
      }
    } catch (error) {
      setErrorMessage(describeError(error, 'Failed to import environment variables.'));
    } finally {
      setImporting(false);
    }
  };

  // Save the whole staged batch, then immediately queue a full rebuild
  // (clone + reinstall + rebuild the image) rather than a fast restart — the
  // right choice when a var is baked into the build itself (e.g. a
  // framework's build-time env vars), which a restart alone would not pick
  // up since it reuses the existing image.
  const handleSaveAndRebuild = async () => {
    if (!deploymentId || importableStaged.length === 0) return;

    setRebuilding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const summary = await saveStagedBatch(deploymentId);
      setImportSummary(summary);

      if (summary.saved === 0) {
        if (summary.failed > 0) {
          setErrorMessage(`Nothing was saved (${summary.failed} failed) — rebuild not started.`);
        }
        return;
      }

      await refreshEnv(deploymentId).catch(() => {});

      const deployResponse = await api.post<DeployResponse>(`/apps/${deploymentId}/deploy`);
      markNodeDeployQueued(deploymentId, deployResponse.data?.jobId ?? null);
      setDrawerTab('logs');

      const name = serviceName?.trim() || 'Service';
      toast.success(
        `Saved ${summary.saved} variable${summary.saved === 1 ? '' : 's'} and queued a rebuild for ${name} — watch the Logs tab.`,
        'Rebuild started',
      );
    } catch (error) {
      setErrorMessage(describeError(error, 'Saved the variables, but failed to queue the rebuild.'));
    } finally {
      setRebuilding(false);
    }
  };

  const renderStagedRow = (entry: StagedEntry) => {
    const blank = isBlankStagedEntry(entry);
    const style = statusStyles[entry.status];
    const collides = !blank && entry.status !== 'invalid' && existingKeys.has(entry.key);
    const revealed = revealedIds.has(entry.id);

    return (
      <div key={entry.id} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-start gap-2 px-3 py-2">
        <div className="min-w-0">
          <input
            value={entry.originalKey}
            onChange={(event) => updateStagedEntry(entry.id, { key: event.target.value })}
            placeholder="KEY"
            className={`w-full min-w-0 rounded-lg border bg-brand-900/80 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60 ${
              !blank && entry.status === 'invalid' ? 'border-rose-500/40' : 'border-brand-700'
            }`}
          />
          {entry.status === 'adapted' && entry.key ? (
            <p className="mt-1 truncate font-mono text-[10px] text-amber-300/80" title={entry.notes.join(' · ')}>
              → {entry.key}
            </p>
          ) : null}
          {!blank && entry.notes.length > 0 && entry.status !== 'adapted' ? (
            <p className="mt-1 text-[10px] text-zinc-500">{entry.notes.join(' · ')}</p>
          ) : null}
          {collides ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              {overwrite ? 'will replace the existing value' : 'already set — will be skipped'}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <input
            value={entry.value}
            onChange={(event) => updateStagedEntry(entry.id, { value: event.target.value })}
            placeholder="value"
            type={entry.sensitive && !revealed ? 'password' : 'text'}
            className="w-full min-w-0 rounded-lg border border-brand-700 bg-brand-900/80 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
          />
          {entry.sensitive ? (
            <button
              type="button"
              onClick={() => toggleRevealed(entry.id)}
              className="shrink-0 rounded-lg border border-brand-700 bg-brand-900/80 p-1.5 text-zinc-400 transition hover:border-brand-600 hover:text-zinc-100"
              aria-label={revealed ? 'Hide value' : 'Show value'}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>

        <span
          className={`shrink-0 self-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
            blank ? 'border-brand-700 bg-brand-900/40 text-zinc-500' : style.className
          }`}
        >
          {blank ? 'empty' : collides && entry.status !== 'invalid' ? (overwrite ? 'replace' : 'skip') : style.label}
        </span>

        <button
          type="button"
          onClick={() => removeStagedEntry(entry.id)}
          className="shrink-0 self-center rounded-lg border border-brand-700 bg-brand-900/80 p-1.5 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300"
          aria-label="Remove row"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="rounded-gf-2xl border border-brand-700/50 bg-brand-900/90 p-4 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Environment Variables</h2>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{title}</p>
        </div>
        {envItems.length > 0 ? (
          <span className="shrink-0 rounded-full border border-brand-700 bg-brand-850/70 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
            {envItems.length}
          </span>
        ) : null}
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
          onClick={() => setImportOpen((open) => !open)}
          disabled={!deploymentId}
          aria-expanded={importOpen}
          className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-brand-900/80 px-4 py-2 text-xs font-medium text-zinc-100 transition hover:border-brand-500 hover:bg-brand-850 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileUp className="h-3.5 w-3.5" />
          Import .env
        </button>
        <button
          type="button"
          onClick={handleRestartAndApply}
          disabled={restarting || !deploymentId}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-brand-200 transition hover:bg-accent/15 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
          {restarting
            ? needsRedeploy ? 'Queuing redeploy…' : 'Restarting…'
            : needsRedeploy ? 'Redeploy & Apply Changes' : 'Restart & Apply Changes'}
        </button>
      </div>

      {importOpen ? (
        <div className="mb-4 rounded-2xl border border-brand-700 bg-brand-900/60 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-medium text-zinc-100">Import environment variables</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Drop a file, choose one, or paste the contents — each line becomes an editable
                variable below, where you can fix a key, change a value, add more, or remove one
                before saving. Keys are normalised to <span className="font-mono">UPPER_SNAKE_CASE</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                resetImport();
              }}
              className="rounded-full border border-brand-700 bg-brand-900/80 p-1.5 text-zinc-400 transition hover:border-brand-600 hover:text-zinc-100"
              aria-label="Close import panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`mb-3 rounded-xl border border-dashed px-4 py-5 text-center transition ${
              dragActive ? 'border-accent/60 bg-accent/5' : 'border-brand-600 bg-brand-900/40'
            }`}
          >
            <Upload className="mx-auto mb-2 h-5 w-5 text-zinc-500" />
            <p className="text-xs text-zinc-400">
              Drop a <span className="font-mono">.env</span> file here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-brand-200 underline underline-offset-2 transition hover:text-zinc-100"
              >
                browse
              </button>
            </p>
            {importFileName ? (
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{importFileName}</p>
            ) : null}
            {/* Deliberately unrestricted: `accept` is a hard filter in the OS
                picker, and a file named `.env` has no extension to match on,
                so restricting it hides exactly the file people come here for.
                Unparseable content is reported in the preview instead. */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setImportFileName(null);
              setImportSummary(null);
            }}
            rows={6}
            spellCheck={false}
            placeholder={'DATABASE_URL=postgres://user:pass@host:5432/db\nAPI_TOKEN=sk-…'}
            className="w-full resize-y rounded-xl border border-brand-600 bg-brand-900/80 px-3 py-2 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
          />

          {/* Always reachable, even with nothing pasted yet — paste a file
              and edit it below, add variables here with no file at all, or
              mix both. */}
          <button
            type="button"
            onClick={addStagedEntry}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-dashed border-brand-600 bg-brand-900/60 px-3 py-1.5 text-[11px] text-zinc-300 transition hover:border-brand-500 hover:text-zinc-100"
          >
            <Plus className="h-3 w-3" />
            Add a variable manually
          </button>

          {importText.trim() !== '' || stagedEntries.length > 0 ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span className="text-zinc-300">{importableStaged.length} to import</span>
                {stagedCounts.adapted > 0 ? (
                  <span className="text-amber-300/80">{stagedCounts.adapted} adapted</span>
                ) : null}
                {stagedCounts.duplicate > 0 ? (
                  <span>{stagedCounts.duplicate} redefined</span>
                ) : null}
                {stagedCounts.invalid > 0 ? (
                  <span className="text-rose-300/80">{stagedCounts.invalid} skipped</span>
                ) : null}
              </div>

              {/* Every row here is a live, editable variable — not just a
                  read-only preview of the file. Fix a typo'd key, tweak a
                  value, drop a row you don't want, or add one that wasn't in
                  the file at all, all before anything is sent to the server. */}
              <div className="mt-2 overflow-hidden rounded-xl border border-brand-700 bg-brand-900/40">
                <div className="grid grid-cols-[1fr_1.4fr_auto_auto] gap-2 border-b border-brand-700/60 bg-brand-850/50 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  <span className="font-mono">Key</span>
                  <span className="font-mono">Value</span>
                  <span className="font-mono">Status</span>
                  <span className="font-mono sr-only">Remove</span>
                </div>
                <div className="max-h-56 divide-y divide-brand-700/50 overflow-y-auto">
                  {stagedEntries.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-zinc-500">
                      No <span className="font-mono">KEY=value</span> pairs yet — paste some above, or add one below.
                    </p>
                  ) : (
                    stagedEntries.map(renderStagedRow)
                  )}
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(event) => setOverwrite(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-brand-600 bg-brand-900 accent-accent"
                />
                Replace values for keys that already exist
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyImport}
                  disabled={importing || rebuilding || importableStaged.length === 0 || !deploymentId}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  {importing
                    ? 'Saving…'
                    : `Save ${importableStaged.length} variable${importableStaged.length === 1 ? '' : 's'}`}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndRebuild}
                  disabled={importing || rebuilding || importableStaged.length === 0 || !deploymentId}
                  title="Saves all the variables above, then triggers a full rebuild — needed for env vars a framework bakes in at build time, which a plain restart wouldn't pick up."
                  className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Hammer className={`h-3.5 w-3.5 ${rebuilding ? 'animate-pulse' : ''}`} />
                  {rebuilding
                    ? 'Saving & rebuilding…'
                    : `Save ${importableStaged.length} & rebuild`}
                </button>
                <button
                  type="button"
                  onClick={resetImport}
                  disabled={importing || rebuilding}
                  className="rounded-full border border-brand-700 bg-brand-900/80 px-4 py-2 text-xs text-zinc-400 transition hover:border-brand-600 hover:text-zinc-100 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </>
          ) : null}

          {importSummary ? (
            <div className="mt-3 rounded-xl border border-brand-700 bg-brand-900/60 p-3 text-[11px] text-zinc-400">
              <p className="text-zinc-200">
                {importSummary.saved} saved · {importSummary.skipped} skipped · {importSummary.failed} failed
              </p>
              {importSummary.failures.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {importSummary.failures.map((failure) => (
                    <li key={failure.key} className="font-mono text-rose-300/80">
                      {failure.key}: {failure.error ?? failure.reason ?? 'failed'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-brand-700">
        <div className="grid grid-cols-[1.2fr_1.8fr_auto] border-b border-brand-700 bg-brand-850/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span className="font-mono">Key</span>
          <span className="font-mono">Value</span>
          <span className="font-mono">Actions</span>
        </div>

        {/* Pinned above the scroll region: always reachable no matter how far
            down the saved list has been scrolled. */}
        <div className="grid grid-cols-[1.2fr_1.8fr_auto] gap-2 border-b border-brand-700/50 bg-brand-900/50 px-4 py-3">
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
            <p className="mt-1 text-xs text-zinc-500">
              Add a key and value above, or import a <span className="font-mono">.env</span> file, then restart to apply.
            </p>
          </div>
        ) : (
          // Bounded + independently scrollable so a long list (or a big
          // .env import) can never push the header/add-row/buttons above out
          // of view — this is the "scroll down" region.
          <div
            ref={listScrollRef}
            onScroll={updateScrollState}
            className="max-h-72 divide-y divide-brand-700/50 overflow-y-auto scroll-smooth"
          >
            {envItems.map((item, index) => (
              <div
                key={`${item.key}-${index}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(item.key, el);
                  else rowRefs.current.delete(item.key);
                }}
                className={`grid grid-cols-[1.2fr_1.8fr_auto] gap-2 px-4 py-3 transition-colors duration-500 ${
                  highlightKey === item.key ? 'bg-emerald-500/10' : ''
                }`}
              >
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
        )}

        {hasOverflow && !atBottom ? (
          <>
            {/* Fade hints that the list continues below the visible edge. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-brand-900/95 to-transparent" />
            <button
              type="button"
              onClick={scrollListToBottom}
              className="absolute bottom-2 right-3 inline-flex items-center gap-1 rounded-full border border-brand-600 bg-brand-850/95 px-2.5 py-1 text-[11px] text-zinc-300 shadow-glow transition hover:border-accent/50 hover:text-zinc-100"
              aria-label="Scroll to bottom of environment variables"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Scroll down
            </button>
          </>
        ) : null}
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Encrypted at rest via Go control plane</p>
    </div>
  );
}
