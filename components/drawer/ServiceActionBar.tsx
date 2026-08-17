'use client';

import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useCanvasStore, type NodeStatus } from '@/store/canvasStore';
import { toast } from '@/store/toastStore';

type ServiceActionBarProps = {
  deploymentId: string | null;
  nodeStatus?: NodeStatus | null;
  serviceName?: string | null;
};

type DeployResponse = {
  jobId?: string;
  message?: string;
};

function actionLabel(status: NodeStatus | null | undefined): string {
  if (status === 'RUNNING') return 'Restart service';
  if (status === 'BUILDING') return 'Redeploy build';
  if (status === 'FAILED') return 'Redeploy service';
  return 'Redeploy service';
}

export function ServiceActionBar({ deploymentId, nodeStatus, serviceName }: ServiceActionBarProps) {
  const [loading, setLoading] = useState(false);
  const markNodeDeployQueued = useCanvasStore((state) => state.markNodeDeployQueued);
  const setDrawerTab = useCanvasStore((state) => state.setDrawerTab);

  if (!deploymentId) return null;

  const isRedeploy = nodeStatus !== 'RUNNING';
  const label = actionLabel(nodeStatus);

  const handleAction = async () => {
    setLoading(true);
    try {
      const endpoint = isRedeploy ? `/apps/${deploymentId}/deploy` : `/apps/${deploymentId}/restart`;
      const response = await api.post<DeployResponse>(endpoint);
      const jobId = response.data?.jobId ?? null;

      markNodeDeployQueued(deploymentId, jobId);
      setDrawerTab('logs');

      const name = serviceName?.trim() || 'Service';
      toast.success(
        isRedeploy ? `${name} redeploy queued — watch the Logs tab for progress.` : `${name} restart queued.`,
        isRedeploy ? 'Redeploy started' : 'Restart started',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue deployment action.';
      toast.error(message, isRedeploy ? 'Redeploy failed' : 'Restart failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-brand-700/50 px-5 py-3">
      <div className="flex items-center justify-between gap-3 rounded-gf-2xl border border-brand-700/50 bg-brand-850/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Deploy actions</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {nodeStatus === 'RUNNING'
              ? 'Fast restart — skips git clone and image rebuild (~seconds).'
              : 'Full redeploy — clones repo and rebuilds the image (can take 1–3 min).'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAction}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/30 bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Queuing…' : label}
        </button>
      </div>
    </div>
  );
}
