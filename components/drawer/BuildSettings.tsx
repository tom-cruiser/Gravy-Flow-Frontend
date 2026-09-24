'use client';

import { useEffect, useState } from 'react';
import { Hammer } from 'lucide-react';
import { getBuildSettings, updateBuildSettings, type BuildSettings as BuildSettingsValue } from '@/lib/buildSettingsApi';
import { domainErrorMessage } from '@/lib/domainApi';
import { toast } from '@/store/toastStore';

type BuildSettingsProps = {
  deploymentId: string | null;
};

const EMPTY: BuildSettingsValue = { dockerfilePath: '', containerPort: 0 };

// Monorepo support: name the Dockerfile this service builds (the repo root
// stays the build context) and, optionally, the port it listens on. Changes
// apply on the next redeploy — a restart reuses the existing image.
export function BuildSettings({ deploymentId }: BuildSettingsProps) {
  const [saved, setSaved] = useState<BuildSettingsValue>(EMPTY);
  const [dockerfilePath, setDockerfilePath] = useState('');
  const [port, setPort] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setSaved(EMPTY);
    setDockerfilePath('');
    setPort('');
    setLoaded(false);
    setErrorText(null);
    if (!deploymentId) return;

    let active = true;
    getBuildSettings(deploymentId)
      .then((settings) => {
        if (!active) return;
        setSaved(settings);
        setDockerfilePath(settings.dockerfilePath);
        setPort(settings.containerPort > 0 ? String(settings.containerPort) : '');
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setErrorText(domainErrorMessage(err, 'Failed to load build settings.'));
      });
    return () => {
      active = false;
    };
  }, [deploymentId]);

  const parsedPort = port.trim() === '' ? 0 : Number(port);
  const portInvalid = !Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535;
  const dirty = dockerfilePath.trim() !== saved.dockerfilePath || (portInvalid ? true : parsedPort !== saved.containerPort);

  const handleSave = async () => {
    if (!deploymentId || portInvalid) return;
    setSaving(true);
    setErrorText(null);
    try {
      const next = await updateBuildSettings(deploymentId, { dockerfilePath: dockerfilePath.trim(), containerPort: parsedPort });
      setSaved(next);
      setDockerfilePath(next.dockerfilePath);
      toast.success('Redeploy the service to build with these settings.', 'Build settings saved');
    } catch (err) {
      setErrorText(domainErrorMessage(err, 'Failed to save build settings.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-brand-700 bg-brand-900/90 p-4">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <Hammer className="h-3.5 w-3.5 text-brand-300" /> Build
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          For monorepos: the Dockerfile to build, relative to the repository root. Leave empty to auto-detect the project at the root.
        </p>
      </div>

      {errorText ? (
        <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300">{errorText}</div>
      ) : null}

      <label htmlFor="dockerfilePath" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
        Dockerfile path
      </label>
      <input
        id="dockerfilePath"
        value={dockerfilePath}
        onChange={(event) => setDockerfilePath(event.target.value)}
        disabled={!loaded || saving}
        placeholder="services/auth-tenant/Dockerfile"
        spellCheck={false}
        className="gf-input font-mono text-xs normal-case tracking-normal"
      />

      <label htmlFor="containerPort" className="mb-1.5 mt-3 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
        Container port <span className="normal-case tracking-normal text-zinc-500">(optional)</span>
      </label>
      <input
        id="containerPort"
        inputMode="numeric"
        value={port}
        onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, ''))}
        disabled={!loaded || saving}
        placeholder="auto — from the Dockerfile's EXPOSE, else 8080"
        className="gf-input text-xs font-normal normal-case tracking-normal"
      />
      {portInvalid ? <p className="mt-1 text-[11px] text-rose-300">Port must be between 1 and 65535.</p> : null}

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!loaded || saving || !dirty || portInvalid}
          className="gf-btn-primary inline-flex w-auto items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save build settings'}
        </button>
      </div>
    </div>
  );
}
