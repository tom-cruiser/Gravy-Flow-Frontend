import type { PointerEvent } from 'react';
import { AlertTriangle, Database, Globe2, LoaderCircle } from 'lucide-react';
import type { CanvasNode } from '@/store/canvasStore';

const statusStyles: Record<CanvasNode['status'], string> = {
  RUNNING: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.1)]',
  BUILDING: 'border-amber-500/20 bg-amber-500/10 text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.08)]',
  FAILED: 'border-rose-500/20 bg-rose-500/10 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.1)]',
};

const statusLabels: Record<CanvasNode['status'], string> = {
  RUNNING: 'Running',
  BUILDING: 'Building',
  FAILED: 'Failed',
};

// Allocation tier mirrors the backend deploy defaults (defaultDeployCPU /
// defaultDeployMemoryMB). These are the limits a service is provisioned with,
// not live usage — there is no per-node telemetry endpoint yet.
const ALLOCATED_VCPU = '0.50';
const ALLOCATED_MEMORY = '512 MB';

type ServiceNodeProps = {
  node: CanvasNode;
  selected: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
};

export function ServiceNode({ node, selected, onPointerDown }: ServiceNodeProps) {
  const Icon = node.type === 'db' ? Database : Globe2;

  const isRunning = node.status === 'RUNNING';
  const isBuilding = node.status === 'BUILDING';
  const isFailed = node.status === 'FAILED';

  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerDown(event, node.id)}
      className={`pointer-events-auto group absolute w-[260px] rounded-gf-2xl border bg-brand-850/90 p-4 text-left backdrop-blur-md transition-shadow duration-150 ease-out will-change-transform ${
        selected
          ? 'border-accent ring-1 ring-accent/40 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(147,51,234,0.18)] z-10'
          : 'border-brand-700/60 hover:border-brand-500/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)]'
      }`}
      style={{
        /* GPU-Accelerated matrix layout translation:
          Combines offset coordinate mapping with centration tracking using translate3d
          to bypass browser re-layouts entirely during real-time movement.
        */
        transform: `translate3d(calc(${node.positionX}px - 50%), calc(${node.positionY}px - 50%), 0)`,
      }}
    >
      {/* Top Meta Information Segment */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`rounded-gf border p-2.5 shrink-0 transition-colors ${
              selected ? 'border-accent/30 bg-accent/10 text-brand-300' : 'border-brand-700 bg-brand-900 text-zinc-400'
            } ${isFailed ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : ''}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate tracking-tight">{node.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">{node.type} service</p>
          </div>
        </div>

        {/* Status Pills */}
        <div className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide shrink-0 ${statusStyles[node.status]}`}>
          <div className="flex items-center gap-1.5 h-4">
            {isRunning && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            )}
            {isBuilding && <LoaderCircle className="h-3 w-3 animate-spin text-amber-400" />}
            {isFailed && <AlertTriangle className="h-3 w-3 text-rose-400" />}
            <span>{statusLabels[node.status]}</span>
          </div>
        </div>
      </div>

      {/* Infrastructure Specs Grid block */}
      <div className="mt-4 space-y-2.5 text-xs">
        <div className="rounded-gf border border-brand-700/60 bg-brand-900/40 p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Repository target</p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-300" title={node.repo}>{node.repo}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-gf border border-brand-700/60 bg-brand-900/40 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">CPU allocation</p>
            <p className="mt-1 font-semibold text-zinc-200 tracking-tight">{ALLOCATED_VCPU} <span className="text-[10px] font-normal text-zinc-500">vCPU</span></p>
          </div>
          <div className="rounded-gf border border-brand-700/60 bg-brand-900/40 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Memory limit</p>
            <p className="mt-1 font-semibold text-zinc-200 tracking-tight">{ALLOCATED_MEMORY}</p>
          </div>
        </div>
      </div>
    </button>
  );
}