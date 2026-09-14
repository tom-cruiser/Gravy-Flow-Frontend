'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileUp, Plus, RefreshCcw, Trash2, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  ENV_FILE_MAX_BYTES,
  chunk,
  parseEnvFile,
  previewValue,
  type EnvEntryStatus,
  type ParsedEnvEntry,
} from '@/lib/envFile';

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
    const data = (error as { response?: { data?: { error?: string; details?: string } } }).response?.data;
    if (data?.details) return data.details;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : fallback;
}

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

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const parsedImport = useMemo(() => parseEnvFile(importText), [importText]);

  const existingKeys = useMemo(() => new Set(envItems.map((item) => item.key)), [envItems]);

  const refreshEnv = useCallback(async (id: string) => {
    const response = await api.get<EnvListResponse>(`/apps/${id}/env`);
    setEnvItems(response.data.envVars ?? []);
  }, []);

  const resetImport = useCallback(() => {
    setImportText('');
    setImportFileName(null);
    setImportSummary(null);
    setDragActive(false);
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
      setErrorMessage(describeError(error, 'Failed to restart service.'));
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

  const handleApplyImport = async () => {
    if (!deploymentId || parsedImport.importable.length === 0) return;

    setImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const summary: ImportSummary = { saved: 0, skipped: 0, failed: 0, failures: [] };

    try {
      // Batched sequentially rather than in parallel: the batches upsert into
      // the same deployment, and a partial failure is easier to report when the
      // batches land in a known order.
      for (const batch of chunk(parsedImport.importable, BULK_BATCH_SIZE)) {
        const response = await api.post<BulkResponse>(`/apps/${deploymentId}/env/bulk`, {
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

  const renderEntryRow = (entry: ParsedEnvEntry, index: number) => {
    const style = statusStyles[entry.status];
    const collides = entry.status !== 'invalid' && existingKeys.has(entry.key);

    return (
      <div
        key={`${entry.key}-${entry.line}-${index}`}
        className="grid grid-cols-[1fr_auto] items-start gap-2 px-3 py-2"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-mono text-xs text-zinc-100" title={entry.key || entry.originalKey}>
              {entry.key || entry.originalKey || `line ${entry.line}`}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-zinc-600">L{entry.line}</span>
          </div>
          <p className="truncate font-mono text-[11px] text-zinc-500" title={entry.sensitive ? undefined : entry.value}>
            {previewValue(entry)}
          </p>
          {entry.status === 'adapted' ? (
            <p className="font-mono text-[10px] text-amber-300/80">
              {entry.originalKey} → {entry.key}
            </p>
          ) : null}
          {entry.notes.length > 0 && entry.status !== 'adapted' ? (
            <p className="text-[10px] text-zinc-500">{entry.notes.join(' · ')}</p>
          ) : null}
          {collides ? (
            <p className="text-[10px] text-zinc-500">
              {overwrite ? 'will replace the existing value' : 'already set — will be skipped'}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${style.className}`}
        >
          {collides && entry.status !== 'invalid' ? (overwrite ? 'replace' : 'skip') : style.label}
        </span>
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
          {restarting ? 'Restarting…' : 'Restart & Apply Changes'}
        </button>
      </div>

      {importOpen ? (
        <div className="mb-4 rounded-2xl border border-brand-700 bg-brand-900/60 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-medium text-zinc-100">Import from .env</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Drop a file, choose one, or paste the contents. Keys are normalised to
                <span className="font-mono"> UPPER_SNAKE_CASE</span> before saving.
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

          {importText.trim() !== '' ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span className="text-zinc-300">
                  {parsedImport.importable.length} to import
                </span>
                {parsedImport.counts.adapted > 0 ? (
                  <span className="text-amber-300/80">{parsedImport.counts.adapted} adapted</span>
                ) : null}
                {parsedImport.counts.duplicate > 0 ? (
                  <span>{parsedImport.counts.duplicate} redefined</span>
                ) : null}
                {parsedImport.counts.invalid > 0 ? (
                  <span className="text-rose-300/80">{parsedImport.counts.invalid} skipped</span>
                ) : null}
              </div>

              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-brand-700 bg-brand-900/40 divide-y divide-brand-700/50">
                {parsedImport.entries.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-zinc-500">
                    No <span className="font-mono">KEY=value</span> pairs found.
                  </p>
                ) : (
                  parsedImport.entries.map(renderEntryRow)
                )}
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
                  disabled={importing || parsedImport.importable.length === 0 || !deploymentId}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-600 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  {importing
                    ? 'Importing…'
                    : `Import ${parsedImport.importable.length} variable${
                        parsedImport.importable.length === 1 ? '' : 's'
                      }`}
                </button>
                <button
                  type="button"
                  onClick={resetImport}
                  disabled={importing}
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
