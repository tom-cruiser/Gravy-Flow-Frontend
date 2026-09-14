'use client';

import { useState } from 'react';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useCanvasStore, type NodeStatus } from '@/store/canvasStore';
import { toast } from '@/store/toastStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const markNodeDeployQueued = useCanvasStore((state) => state.markNodeDeployQueued);
  const setDrawerTab = useCanvasStore((state) => state.setDrawerTab);
  const removeNode = useCanvasStore((state) => state.removeNode);
  const closeNodePanel = useCanvasStore((state) => state.closeNodePanel);

  if (!deploymentId) return null;

  const isRedeploy = nodeStatus !== 'RUNNING';
  const label = actionLabel(nodeStatus);
  const name = serviceName?.trim() || 'Service';
  const confirmMatches = confirmText.trim() === name;

  const handleDelete = async () => {
    if (!confirmMatches) return;

    setDeleting(true);
    try {
      await api.delete(`/apps/${deploymentId}`);
      toast.success(`${name} has been deleted.`, 'Service deleted');
      setDeleteOpen(false);
      closeNodePanel();
      removeNode(deploymentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete service.';
      toast.error(message, 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async () => {
    setLoading(true);
    try {
      const endpoint = isRedeploy ? `/apps/${deploymentId}/deploy` : `/apps/${deploymentId}/restart`;
      const response = await api.post<DeployResponse>(endpoint);
      const jobId = response.data?.jobId ?? null;

      markNodeDeployQueued(deploymentId, jobId);
      setDrawerTab('logs');

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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-full border border-brand-700 bg-brand-900/60 p-2 text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300"
            aria-label="Delete service"
            title="Delete service"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Queuing…' : label}
          </button>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This stops and removes the running container and permanently deletes {name} from your dashboard.
              This cannot be undone from here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400">
              Type <span className="font-mono font-semibold text-zinc-200">{name}</span> to confirm.
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && confirmMatches && handleDelete()}
              placeholder={name}
              autoFocus
              className="w-full rounded-xl border border-brand-600 bg-brand-900/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-rose-500/60"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-full border border-brand-700 bg-brand-900/80 px-4 py-2 text-xs text-zinc-300 transition hover:border-brand-600 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmMatches || deleting}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/90 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className={`h-3.5 w-3.5 ${deleting ? 'animate-pulse' : ''}`} />
              {deleting ? 'Deleting…' : 'Delete service'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
