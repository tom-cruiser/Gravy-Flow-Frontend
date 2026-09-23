'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Lock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

type RepoAccessProps = {
  deploymentId: string | null;
  repo?: string | null;
};

type GitTokenStatus = { configured: boolean; githubApp?: boolean; githubAppActive?: boolean };

function errorMessage(err: unknown, fallback: string) {
  const axiosErr = err as { response?: { data?: { error?: string; details?: string } } };
  const details = axiosErr?.response?.data?.details;
  const code = axiosErr?.response?.data?.error;
  if (details) return details;
  if (code) return code.replace(/_/g, ' ');
  return fallback;
}

// Access token for cloning a private repository. Write-only: the control
// plane only ever says whether one is set, never returns it.
export function RepoAccess({ deploymentId, repo }: RepoAccessProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [githubApp, setGithubApp] = useState<{ linked: boolean; active: boolean }>({ linked: false, active: false });
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  useEffect(() => {
    setToken('');
    setErrorText(null);
    setSuccessText(null);
    setConfigured(null);
    setGithubApp({ linked: false, active: false });
    if (!deploymentId) return;

    let active = true;
    api
      .get<GitTokenStatus>(`/apps/${deploymentId}/git-token`)
      .then((response) => {
        if (!active) return;
        setConfigured(Boolean(response.data?.configured));
        setGithubApp({ linked: Boolean(response.data?.githubApp), active: Boolean(response.data?.githubAppActive) });
      })
      .catch((err) => {
        if (active) setErrorText(errorMessage(err, 'Failed to load repository access settings.'));
      });

    return () => {
      active = false;
    };
  }, [deploymentId]);

  const handleSave = async () => {
    if (!deploymentId || !token.trim()) return;
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await api.put(`/apps/${deploymentId}/git-token`, { token: token.trim() });
      setConfigured(true);
      setToken('');
      setSuccessText('Token saved. Redeploy the service to clone with it.');
    } catch (err) {
      setErrorText(errorMessage(err, 'Failed to save the access token.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deploymentId) return;
    setRemoving(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await api.delete(`/apps/${deploymentId}/git-token`);
      setConfigured(false);
      setSuccessText('Token removed.');
    } catch (err) {
      setErrorText(errorMessage(err, 'Failed to remove the access token.'));
    } finally {
      setRemoving(false);
    }
  };

  const isHttps = !repo || repo.startsWith('https://');

  return (
    <div className="rounded-2xl border border-brand-700 bg-brand-900/90 p-4 shadow-glow">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-zinc-100">Repository access</h2>
        <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
          {repo ? repo.replace(/^https?:\/\//, '') : 'Source repository'}
        </p>
      </div>

      {githubApp.linked ? null : (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-700 bg-brand-850/60 px-3 py-2.5 text-xs">
          <Lock className="h-3.5 w-3.5 shrink-0 text-brand-300" />
          {configured === null ? (
            <span className="text-zinc-500">Checking…</span>
          ) : configured ? (
            <span className="text-emerald-300">An access token is set; it's used for every clone of this repository.</span>
          ) : (
            <span className="text-zinc-400">No access token. Public repositories don't need one.</span>
          )}
        </div>
      )}

      {githubApp.linked ? (
        <div
          className={`mb-3 rounded-xl border p-3 text-xs leading-relaxed ${
            githubApp.active
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
          }`}
        >
          {githubApp.active
            ? 'Cloned through the GravyFlow GitHub App with a short-lived token minted for every build. No access token needed.'
            : "This service clones through the GitHub App, but its installation was removed, suspended, or unlinked. Reconnect GitHub from New Service, then redeploy."}
        </div>
      ) : null}

      {errorText ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="leading-relaxed">{errorText}</span>
        </div>
      ) : null}
      {successText ? (
        <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          {successText}
        </div>
      ) : null}

      {githubApp.linked ? null : isHttps ? (
        <>
          <label htmlFor="gitToken" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            {configured ? 'Replace access token' : 'Access token'}
          </label>
          <input
            id="gitToken"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="github_pat_…"
            className="gf-input font-normal normal-case tracking-normal"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            On GitHub, create a fine-grained token limited to this repository with <em>Contents: Read-only</em>. It&apos;s
            stored encrypted and never shown again.
          </p>

          <div className="mt-4 flex items-center justify-end gap-2">
            {configured ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing || saving}
                className="inline-flex items-center gap-1.5 rounded-gf border border-brand-700 bg-brand-800/50 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {removing ? 'Removing…' : 'Remove'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || removing || !token.trim()}
              className="gf-btn-primary inline-flex w-auto items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-40"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save token'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-400">
          Access tokens work with https:// repository URLs only; this service uses an SSH URL.
        </p>
      )}
    </div>
  );
}
