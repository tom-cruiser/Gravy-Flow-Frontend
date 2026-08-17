'use client';

import { useMemo } from 'react';
import { Activity, Database, ChevronLeft, Shield } from 'lucide-react';
import { useCanvasStore, type DrawerTab } from '@/store/canvasStore';
import { EnvManager } from './EnvManager';
import { LogViewer } from './LogViewer';
import { DomainManager } from './DomainManager';
import { ServiceActionBar } from './ServiceActionBar';

type RightDrawerProps = {
  open: boolean;
};

const tabs: Array<{ id: DrawerTab; label: string; icon: typeof Activity }> = [
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'env', label: 'Env', icon: Database },
  { id: 'networking', label: 'Domains', icon: Shield },
];

export function RightDrawer({ open }: RightDrawerProps) {
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const drawerTab = useCanvasStore((state) => state.drawerTab);
  const setDrawerTab = useCanvasStore((state) => state.setDrawerTab);
  const closeNodePanel = useCanvasStore((state) => state.closeNodePanel);
  const selectedNode = useCanvasStore((state) =>
    state.nodes.find((node) => node.id === state.selectedNodeId) ?? null,
  );

  const heading = useMemo(() => selectedNode?.name ?? 'Select a service', [selectedNode]);

  return (
    <aside
      className={`fixed right-0 top-0 z-30 flex h-screen w-[420px] max-w-[90vw] transform border-l border-brand-700/50 bg-brand-900/95 text-zinc-100 shadow-[-40px_0_80px_rgba(0,0,0,0.45)] backdrop-blur transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-brand-700/50 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-brand-400">Context Panel</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">{heading}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {selectedNode ? `${selectedNode.type.toUpperCase()} • ${selectedNode.status}` : 'No node selected'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeNodePanel}
            className="rounded-full border border-brand-700 bg-brand-800 p-2 text-zinc-400 transition hover:border-brand-600 hover:text-zinc-100"
            aria-label="Close drawer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-brand-700/50 px-5 py-3">
          <div
            className="grid gap-2 rounded-gf-2xl border border-brand-700/50 bg-brand-850/60 p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === drawerTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDrawerTab(tab.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-gf px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-accent text-zinc-900 shadow-glow-accent' : 'text-zinc-400 hover:bg-brand-800 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <ServiceActionBar
          deploymentId={selectedNodeId}
          nodeStatus={selectedNode?.status ?? null}
          serviceName={selectedNode?.name ?? null}
        />

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="relative h-full">
            <div className={drawerTab === 'logs' ? 'h-full' : 'hidden'}>
              <LogViewer
                deploymentId={selectedNodeId}
                jobId={selectedNode?.jobId ?? null}
                statusMessage={selectedNode?.statusMessage ?? null}
                nodeStatus={selectedNode?.status ?? null}
              />
            </div>
            {drawerTab === 'env' ? (
              <div className="h-full">
                <EnvManager deploymentId={selectedNodeId} />
              </div>
            ) : null}
            {drawerTab === 'networking' ? (
              <div className="h-full">
                <DomainManager deploymentId={selectedNodeId} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
