'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeStatus } from '@/store/canvasStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

type LogViewerProps = {
  deploymentId: string | null;
  jobId?: string | null;
  statusMessage?: string | null;
  nodeStatus?: NodeStatus | null;
};

type LogLine = {
  text: string;
  stream?: 'stdout' | 'stderr' | 'info';
};

type DeploymentJobStatusDTO = {
  jobId?: string;
  deploymentId?: string;
  status?: string;
  stage?: string;
  message?: string;
  progress?: number;
  error?: string;
};

type LogPhase = 'idle' | 'build' | 'runtime' | 'failure';

type DeployLogResponse = {
  status?: string;
  statusMessage?: string;
  lastJobId?: string;
  lines?: Array<{ text?: string; stream?: string }>;
  job?: DeploymentJobStatusDTO;
};

const idleLines: LogLine[] = [
  { text: '[ready] waiting for logs...' },
  { text: '[info] select a service on the canvas to stream build or runtime output.' },
];

const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 8000;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isAccessTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return Date.now() >= payload.exp * 1000;
}

const SESSION_EXPIRED_LINE: LogLine = {
  text: '[warn] Session expired — please log in again.',
  stream: 'stderr',
};

function buildApiWebSocketUrl(path: string, accessToken: string): string {
  const restBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const url = new URL(`${restBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, origin);

  const secure =
    url.protocol === 'https:' ||
    (typeof window !== 'undefined' && window.location.protocol === 'https:');
  url.protocol = secure ? 'wss:' : 'ws:';
  url.searchParams.set('token', accessToken);

  return url.toString();
}

function parseContainerMessage(raw: string): LogLine[] {
  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed.line === 'string') {
      return [{ text: parsed.line, stream: parsed.stream }];
    }

    if (parsed && typeof parsed.error === 'string') {
      return [{ text: `[error] ${parsed.error}`, stream: 'stderr' }];
    }

    if (parsed && typeof parsed.message === 'string') {
      return [{ text: `[info] ${parsed.message}`, stream: 'info' }];
    }

    return [{ text: raw }];
  } catch {
    return raw
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter(Boolean)
      .map((text) => ({ text }));
  }
}

function formatJobStatusLine(status: DeploymentJobStatusDTO): LogLine {
  const stage = status.stage?.trim() || status.status?.trim() || 'update';
  const message = status.message?.trim() || 'working…';
  const progress = typeof status.progress === 'number' ? ` (${status.progress}%)` : '';
  const isError = status.status === 'failed' || Boolean(status.error);

  return {
    text: `[${stage}] ${message}${progress}`,
    stream: isError ? 'stderr' : 'info',
  };
}

function resolveInitialPhase(
  nodeStatus: NodeStatus | null | undefined,
  jobId: string | null | undefined,
): LogPhase {
  if (nodeStatus === 'FAILED') return 'failure';
  if (nodeStatus === 'BUILDING' && jobId) return 'build';
  if (nodeStatus === 'RUNNING') return 'runtime';
  if (nodeStatus === 'BUILDING') return 'build';
  return 'idle';
}

export function LogViewer({ deploymentId, jobId, statusMessage, nodeStatus }: LogViewerProps) {
  const [lines, setLines] = useState<LogLine[]>(idleLines);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'reconnecting' | 'open' | 'closed' | 'error'>('idle');
  const [phase, setPhase] = useState<LogPhase>('idle');
  const [buildProgress, setBuildProgress] = useState(0);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const runtimeSocketUrl = useMemo(() => {
    if (!deploymentId || !accessToken) return null;
    return buildApiWebSocketUrl(`apps/${deploymentId}/logs`, accessToken);
  }, [deploymentId, accessToken]);

  const buildSocketUrl = useMemo(() => {
    if (!jobId || !accessToken) return null;
    return buildApiWebSocketUrl(`jobs/${jobId}/stream`, accessToken);
  }, [accessToken, jobId]);

  // Reset when the selected deployment changes.
  useEffect(() => {
    if (!deploymentId) {
      setLines(idleLines);
      setStatus('idle');
      setBuildProgress(0);
      setPhase('idle');
      return;
    }

    setLines(idleLines);
    setBuildProgress(0);
    setPhase(resolveInitialPhase(nodeStatus, jobId));
  }, [deploymentId]);

  // Follow node status transitions for the active deployment.
  useEffect(() => {
    if (!deploymentId) return;

    if (nodeStatus === 'FAILED') {
      setPhase('failure');
      return;
    }

    if (nodeStatus === 'BUILDING') {
      setLines((current) => (current.some((line) => line.stream === 'stderr') ? idleLines : current));
      if (jobId) {
        setPhase('build');
      }
      return;
    }

    if (nodeStatus === 'RUNNING') {
      setPhase('runtime');
      return;
    }
  }, [deploymentId, jobId, nodeStatus]);

  // Failed deployment details (persisted by the control plane).
  useEffect(() => {
    if (phase !== 'failure' || !deploymentId || nodeStatus === 'BUILDING') return;

    let cancelled = false;

    const loadFailureLog = async () => {
      setStatus('connecting');
      setLines([{ text: '[failed] loading deployment failure details…', stream: 'stderr' }]);

      try {
        const params = jobId ? { jobId } : undefined;
        const response = await api.get<DeployLogResponse>(`/apps/${deploymentId}/deploy-log`, { params });
        if (cancelled) return;

        const data = response.data ?? {};
        const nextLines: LogLine[] = [
          {
            text: `[failed] deployment did not succeed (${data.status ?? nodeStatus ?? 'FAILED'}).`,
            stream: 'stderr',
          },
        ];

        const message = data.statusMessage?.trim() || statusMessage?.trim();
        if (message) {
          nextLines.push({ text: `[error] ${message}`, stream: 'stderr' });
        }

        for (const line of data.lines ?? []) {
          if (line.text) {
            nextLines.push({
              text: line.text.startsWith('[') ? line.text : `[error] ${line.text}`,
              stream: line.stream === 'stdout' ? 'stdout' : 'stderr',
            });
          }
        }

        if (data.job?.message && data.job.message !== message) {
          nextLines.push({ text: `[${data.job.stage ?? 'failed'}] ${data.job.message}`, stream: 'stderr' });
        }
        if (data.job?.error && data.job.error !== message) {
          nextLines.push({ text: `[error] ${data.job.error}`, stream: 'stderr' });
        }

        if (nextLines.length === 1) {
          nextLines.push({
            text: '[info] no detailed failure message was recorded for this deployment.',
            stream: 'info',
          });
        }

        setLines(nextLines);
        setBuildProgress(typeof data.job?.progress === 'number' ? data.job.progress : 100);
        setStatus('error');
      } catch {
        if (cancelled) return;
        const fallback: LogLine[] = [
          { text: '[failed] deployment did not succeed.', stream: 'stderr' },
        ];
        if (statusMessage?.trim()) {
          fallback.push({ text: `[error] ${statusMessage.trim()}`, stream: 'stderr' });
        } else {
          fallback.push({
            text: '[info] could not load failure details from the control plane.',
            stream: 'info',
          });
        }
        setLines(fallback);
        setStatus('error');
      }
    };

    void loadFailureLog();

    return () => {
      cancelled = true;
    };
  }, [deploymentId, nodeStatus, phase, statusMessage]);

  // Build progress stream (deployment job updates).
  useEffect(() => {
    if (phase !== 'build' || !buildSocketUrl) return;

    let disposed = false;
    const socket = new WebSocket(buildSocketUrl);

    const append = (line: LogLine) => setLines((prev) => [...prev, line]);

    setLines([{ text: `[build] streaming deployment progress for ${deploymentId?.slice(0, 8)}…`, stream: 'info' }]);
    setStatus('connecting');

    socket.onopen = () => {
      if (disposed) return;
      setStatus('open');
      append({ text: '[build] connected to deployment job stream.', stream: 'info' });
    };

    socket.onmessage = (event) => {
      if (disposed) return;

      const raw = typeof event.data === 'string' ? event.data : '';
      try {
        const parsed = JSON.parse(raw) as DeploymentJobStatusDTO;
        const line = formatJobStatusLine(parsed);
        append(line);

        if (typeof parsed.progress === 'number') {
          setBuildProgress(parsed.progress);
        }

        if (parsed.status === 'completed') {
          append({ text: '[build] deployment finished — switching to runtime logs…', stream: 'info' });
          setPhase('runtime');
        }

        if (parsed.status === 'failed') {
          setStatus('error');
          if (parsed.error) {
            append({ text: `[error] ${parsed.error}`, stream: 'stderr' });
          }
        }
      } catch {
        append({ text: raw, stream: 'info' });
      }
    };

    socket.onerror = () => {
      if (disposed) return;
      setStatus('error');
    };

    socket.onclose = () => {
      if (disposed) return;
      setStatus((current) => (current === 'error' ? current : 'closed'));
    };

    return () => {
      disposed = true;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close(1000, 'build stream closed');
    };
  }, [buildSocketUrl, deploymentId, phase]);

  // Runtime container log stream.
  useEffect(() => {
    if (phase !== 'runtime' || !runtimeSocketUrl) {
      if (phase === 'build' && !buildSocketUrl) {
        setLines([
          { text: '[build] deployment in progress…', stream: 'info' },
          { text: '[info] waiting for build job stream.', stream: 'info' },
        ]);
        setStatus('connecting');
      }
      return;
    }

    let disposed = false;
    let attemptRef = 0;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const append = (line: LogLine) => setLines((prev) => [...prev, line]);

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (disposed) return;

      if (isAccessTokenExpired(accessToken)) {
        setStatus('error');
        setLines([SESSION_EXPIRED_LINE]);
        return;
      }

      const attempt = attemptRef;
      if (attempt === 0) {
        setLines([{ text: `[connecting] streaming runtime logs for ${deploymentId}…`, stream: 'info' }]);
        setStatus('connecting');
      } else {
        setStatus('reconnecting');
      }

      socket = new WebSocket(runtimeSocketUrl);

      socket.onopen = () => {
        attemptRef = 0;
        setStatus('open');
        append({ text: '[connected] runtime log stream open.', stream: 'info' });
      };

      socket.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        const incoming = parseContainerMessage(raw);
        if (incoming.length > 0) {
          setLines((prev) => [...prev, ...incoming]);
        }
      };

      socket.onerror = () => {};

      socket.onclose = (event) => {
        if (disposed) return;

        if (event.code === 1000) {
          setStatus('closed');
          append({ text: '[closed] stream ended.', stream: 'info' });
          return;
        }

        if (attemptRef < MAX_RECONNECT_ATTEMPTS) {
          const nextAttempt = attemptRef + 1;
          attemptRef = nextAttempt;
          const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * 2 ** (nextAttempt - 1),
            RECONNECT_MAX_DELAY_MS,
          );
          setStatus('reconnecting');
          append({
            text: `[reconnecting] stream dropped (code ${event.code}). attempt ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(
              delay / 1000,
            )}s — container may still be starting.`,
            stream: 'info',
          });
          reconnectTimer = window.setTimeout(connect, delay);
        } else {
          setStatus('error');
          append({
            text: `[error] could not establish a runtime log stream after ${MAX_RECONNECT_ATTEMPTS} attempts (code ${event.code}).`,
            stream: 'stderr',
          });
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, 'component unmounted');
      }
    };
  }, [accessToken, deploymentId, phase, runtimeSocketUrl]);

  useEffect(() => {
    const viewport = logViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [lines]);

  const statusDot =
    status === 'open'
      ? 'bg-emerald-400'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-yellow-400 animate-pulse'
        : status === 'error'
          ? 'bg-rose-500'
          : 'bg-zinc-600';

  const heading =
    phase === 'failure' ? 'Deploy Failed' : phase === 'build' ? 'Build Logs' : 'Runtime Logs';
  const badge = phase === 'failure' ? 'FAILED' : phase === 'build' ? 'JOB' : 'WS';

  return (
    <div className="flex h-full flex-col rounded-gf-2xl border border-brand-700/50 bg-brand-950/95 shadow-glow">
      <div className="flex items-center justify-between border-b border-brand-700/50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{heading}</p>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            {deploymentId ? `deployment · ${deploymentId.slice(0, 8)}` : 'No service selected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className="rounded-full border border-brand-600 bg-brand-800 px-2.5 py-1 text-[11px] font-medium text-brand-200">
            {badge}
          </span>
        </div>
      </div>

      {phase === 'build' || phase === 'failure' ? (
        <div className="border-b border-brand-700/50 px-4 py-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{phase === 'failure' ? 'Deploy progress' : 'Build progress'}</span>
            <span>{buildProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === 'failure' ? 'bg-rose-500' : 'bg-accent'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, buildProgress))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div
        ref={logViewportRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-xs leading-6"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap break-words ${
              line.stream === 'stderr'
                ? 'text-rose-400'
                : line.stream === 'info'
                  ? 'text-brand-200'
                  : 'text-emerald-300'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
