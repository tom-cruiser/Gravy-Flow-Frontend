'use client';

import { useEffect, useState } from 'react';
import { Hammer } from 'lucide-react';
import { getBuildSettings, updateBuildSettings, type BuildSettings as BuildSettingsValue } from '@/lib/buildSettingsApi';
import { domainErrorMessage } from '@/lib/domainApi';
import { toast } from '@/store/toastStore';

type BuildSettingsProps = {
  deploymentId: string | null;
};

const EMPTY: BuildSettingsValue = { dockerfilePath: '', containerPort: 0, memoryMB: 0, cpu: 0 };

// Keep in sync with build_settings.go (minAppMemoryMB … maxAppCPU).
const MEMORY_MIN = 128;
const MEMORY_MAX = 16384;
const CPU_MIN = 0.1;
const CPU_MAX = 8;

// Monorepo support: name the Dockerfile this service builds (the repo root
// stays the build context) and, optionally, the port it listens on. Changes
// apply on the next redeploy — a restart reuses the existing image.
export function BuildSettings({ deploymentId }: BuildSettingsProps) {
  const [saved, setSaved] = useState<BuildSettingsValue>(EMPTY);
  const [dockerfilePath, setDockerfilePath] = useState('');
  const [port, setPort] = useState('');
  const [memory, setMemory] = useState('');
  const [cpu, setCpu] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setSaved(EMPTY);
    setDockerfilePath('');
    setPort('');
    setMemory('');
    setCpu('');
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
        setMemory(settings.memoryMB > 0 ? String(settings.memoryMB) : '');
        setCpu(settings.cpu > 0 ? String(settings.cpu) : '');
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
  const parsedMemory = memory.trim() === '' ? 0 : Number(memory);
  const memoryInvalid = !Number.isInteger(parsedMemory) || (parsedMemory !== 0 && (parsedMemory < MEMORY_MIN || parsedMemory > MEMORY_MAX));
  const parsedCpu = cpu.trim() === '' ? 0 : Number(cpu);
  const cpuInvalid = !Number.isFinite(parsedCpu) || (parsedCpu !== 0 && (parsedCpu < CPU_MIN || parsedCpu > CPU_MAX));
  const invalid = portInvalid || memoryInvalid || cpuInvalid;
  const dirty =
    invalid ||
    dockerfilePath.trim() !== saved.dockerfilePath ||
    parsedPort !== saved.containerPort ||
    parsedMemory !== saved.memoryMB ||
    parsedCpu !== saved.cpu;

  const handleSave = async () => {
    if (!deploymentId || invalid) return;
    setSaving(true);
    setErrorText(null);
    try {
      const next = await updateBuildSettings(deploymentId, {
        dockerfilePath: dockerfilePath.trim(),
        containerPort: parsedPort,
        memoryMB: parsedMemory,
        cpu: parsedCpu,
      });
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
          The Dockerfile to build, relative to the repository root. Leave empty to use a root Dockerfile, or auto-detect the project.
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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="memoryMB" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Memory <span className="normal-case tracking-normal text-zinc-500">(MB)</span>
          </label>
          <input
            id="memoryMB"
            inputMode="numeric"
            value={memory}
            onChange={(event) => setMemory(event.target.value.replace(/[^0-9]/g, ''))}
            disabled={!loaded || saving}
            placeholder="default 512"
            className="gf-input text-xs font-normal normal-case tracking-normal"
          />
        </div>
        <div>
          <label htmlFor="cpu" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            CPU <span className="normal-case tracking-normal text-zinc-500">(cores)</span>
          </label>
          <input
            id="cpu"
            inputMode="decimal"
            value={cpu}
            onChange={(event) => setCpu(event.target.value.replace(/[^0-9.]/g, ''))}
            disabled={!loaded || saving}
            placeholder="default 0.5"
            className="gf-input text-xs font-normal normal-case tracking-normal"
          />
        </div>
      </div>
      {memoryInvalid ? <p className="mt-1 text-[11px] text-rose-300">Memory must be between {MEMORY_MIN} and {MEMORY_MAX} MB.</p> : null}
      {cpuInvalid ? <p className="mt-1 text-[11px] text-rose-300">CPU must be between {CPU_MIN} and {CPU_MAX} cores.</p> : null}
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Raise these for apps that run several processes in one container. Counts against your quota.
      </p>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!loaded || saving || !dirty || invalid}
          className="gf-btn-primary inline-flex w-auto items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save build settings'}
        </button>
      </div>
    </div>
  );
}
