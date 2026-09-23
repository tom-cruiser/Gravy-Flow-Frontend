'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Github, Globe, Lock, RefreshCw, Search, Settings2 } from 'lucide-react';
import { fetchGitHubRepos, startGitHubSetup, type GitHubRepo } from '@/lib/githubApi';

type GitHubRepoPickerProps = {
  selected: GitHubRepo | null;
  onSelect: (repo: GitHubRepo) => void;
  // Whether the user has linked at least one installation.
  hasInstallations: boolean;
  disabled?: boolean;
};

function errorMessage(err: unknown, fallback: string) {
  const axiosErr = err as { response?: { data?: { error?: string; details?: string } } };
  return axiosErr?.response?.data?.details ?? axiosErr?.response?.data?.error?.replace(/_/g, ' ') ?? fallback;
}

function relativeTime(iso?: string) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Searchable list of the repositories the user's GitHub App installations can
// access. No URLs or tokens: the control plane resolves the clone URL and
// mints a scoped token for every build.
export function GitHubRepoPicker({ selected, onSelect, hasInstallations, disabled }: GitHubRepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const data = await fetchGitHubRepos();
      setRepos(data.repositories);
      setWarnings(data.warnings ?? []);
    } catch (err) {
      setErrorText(errorMessage(err, 'Failed to load your GitHub repositories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasInstallations) void load();
  }, [hasInstallations, load]);

  const connect = async () => {
    setRedirecting(true);
    setErrorText(null);
    try {
      await startGitHubSetup();
    } catch (err) {
      setErrorText(errorMessage(err, 'Could not start the GitHub connection.'));
      setRedirecting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  if (!hasInstallations) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-brand-700 bg-brand-850/40 px-4 py-6 text-center">
        <Github className="h-6 w-6 text-zinc-300" />
        <div>
          <p className="text-sm font-medium text-zinc-100">Connect your GitHub account</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Install the GravyFlow GitHub App on the repositories you want to deploy. Public and private repositories both work, with
            no access tokens to manage.
          </p>
        </div>
        {errorText ? <p className="text-xs text-rose-300">{errorText}</p> : null}
        <button
          type="button"
          onClick={connect}
          disabled={disabled || redirecting}
          className="gf-btn-primary inline-flex w-auto items-center gap-2 px-4 py-2 text-xs disabled:opacity-40"
        >
          <Github className="h-3.5 w-3.5" />
          {redirecting ? 'Opening GitHub…' : 'Connect GitHub'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repositories"
            aria-label="Search repositories"
            disabled={disabled}
            className="gf-input pl-9 font-normal normal-case tracking-normal"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={disabled || loading}
          className="rounded-gf border border-brand-700 bg-brand-800/50 p-2.5 text-zinc-400 transition-colors hover:border-brand-600 hover:text-zinc-100 disabled:opacity-40"
          aria-label="Refresh repositories"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        role="listbox"
        aria-label="GitHub repositories"
        className="max-h-56 overflow-y-auto rounded-xl border border-brand-700 bg-brand-850/40"
      >
        {loading && !repos ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">Loading repositories…</p>
        ) : errorText ? (
          <div className="flex items-start gap-2 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span className="leading-relaxed">{errorText}</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            {repos && repos.length > 0 ? 'No repositories match your search.' : 'The GitHub App cannot see any repositories yet.'}
          </p>
        ) : (
          filtered.map((repo) => {
            const isSelected = selected?.id === repo.id && selected.installationId === repo.installationId;
            return (
              <button
                key={`${repo.installationId}:${repo.id}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => onSelect(repo)}
                className={`flex w-full items-center gap-2.5 border-b border-brand-800 px-3 py-2.5 text-left text-sm last:border-b-0 transition-colors ${
                  isSelected ? 'bg-accent/15 text-zinc-100' : 'text-zinc-300 hover:bg-brand-800/60'
                }`}
              >
                {repo.private ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Private" />
                ) : (
                  <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-label="Public" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-zinc-500">{repo.owner}/</span>
                  {repo.name}
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">{relativeTime(repo.pushedAt)}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
              </button>
            );
          })
        )}
      </div>

      {warnings.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-amber-300">Some accounts could not be loaded: {warnings.join('; ')}</p>
      ) : null}

      <button
        type="button"
        onClick={connect}
        disabled={disabled || redirecting}
        className="inline-flex items-center gap-1.5 self-start text-[11px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40"
      >
        <Settings2 className="h-3 w-3" />
        {redirecting ? 'Opening GitHub…' : 'Missing a repository? Adjust GitHub App permissions'}
      </button>
    </div>
  );
}
