import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { parseContainerPort } from '@/lib/portMap';

export type NodeType = 'web' | 'db';
export type NodeStatus = 'RUNNING' | 'BUILDING' | 'FAILED';
export type DrawerTab = 'logs' | 'env' | 'networking';

export type CanvasNode = {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  positionX: number;
  positionY: number;
  internalPort: number;
  repo: string;
  jobId?: string | null;
  statusMessage?: string;
};

// Types matching Go backend shapes (cmd/api/db.go)
export type DeploymentRecordDTO = {
  DeploymentID: string;
  ProjectID: string;
  AppName: string;
  SourceRepoURL: string;
  AppPath: string;
  PortMap: string;
  ImageName: string;
  ContainerID: string;
  ContainerName: string;
  Status: string;
  StatusMessage: string;
  CreatedAt: string | null;
  UpdatedAt: string | null;
};

export type AppRecordDTO = {
  id?: string;
  name?: string;
  repo?: string;
  status?: string;
  statusMessage?: string;
  portMap?: string;
  layout?: { x?: number; y?: number } | null;
};

type CanvasTransform = {
  viewportX: number;
  viewportY: number;
  scale: number;
};

type CanvasStore = {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  drawerTab: DrawerTab;
  canvasTransform: CanvasTransform;
  loading: boolean;
  error: string | null;
  setNodes: (nodes: CanvasNode[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  openNodePanel: (nodeId: string, tab?: DrawerTab) => void;
  closeNodePanel: () => void;
  setCanvasTransform: (transform: CanvasTransform) => void;
  addNode: (node: CanvasNode) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  markNodeDeployQueued: (id: string, jobId: string | null) => void;
  loadNodes: () => Promise<void>;
  fetchCanvasData: () => Promise<void>;
  startPollingNodes: (intervalMs?: number) => void;
  stopPollingNodes: () => void;
};

const initialNodes: CanvasNode[] = [];

// Monotonically increasing token identifying the "current" polling loop.
// Bumped by both startPollingNodes (to supersede any prior loop) and
// stopPollingNodes (to invalidate the loop that's currently in flight), so a
// run() that's mid-await when stopPollingNodes fires won't reschedule itself
// after the fact.
let pollGeneration = 0;

function normalizeNodeStatus(raw: string | undefined | null): NodeStatus {
  const upper = String(raw || 'RUNNING').toUpperCase();
  if (upper === 'BUILDING') return 'BUILDING';
  if (upper === 'FAILED') return 'FAILED';
  return 'RUNNING';
}

function mapDeploymentToCanvasNode(item: DeploymentRecordDTO, idx: number): CanvasNode {
  const defaultX = 220 + (idx % 3) * 360;
  const defaultY = 180 + Math.floor(idx / 3) * 240;

  return {
    id: String(item.DeploymentID),
    name: item.AppName || 'unnamed',
    type: String(item.AppName || '').toLowerCase().includes('postgres') ? 'db' : 'web',
    status: normalizeNodeStatus(item.Status),
    positionX: defaultX,
    positionY: defaultY,
    internalPort: parseContainerPort(item.PortMap),
    repo: item.SourceRepoURL || '',
    statusMessage: item.StatusMessage || '',
  };
}

function mapAppToCanvasNode(item: AppRecordDTO, idx: number): CanvasNode {
  const defaultX = 220 + (idx % 3) * 360;
  const defaultY = 180 + Math.floor(idx / 3) * 240;
  return {
    id: String(item.id ?? `app-${idx}`),
    name: item.name ?? 'unnamed',
    type: String(item.name || '').toLowerCase().includes('postgres') ? 'db' : 'web',
    status: normalizeNodeStatus(item.status),
    positionX: Number(item.layout?.x ?? defaultX),
    positionY: Number(item.layout?.y ?? defaultY),
    internalPort: parseContainerPort(item.portMap ?? undefined),
    repo: item.repo ?? '',
    statusMessage: item.statusMessage || '',
  };
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: initialNodes,
  loading: false,
  error: null,
  selectedNodeId: null,
  drawerTab: 'logs',
  canvasTransform: {
    viewportX: 80,
    viewportY: 100,
    scale: 1,
  },
  setNodes: (nodes) => set({ nodes }),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setDrawerTab: (drawerTab) => set({ drawerTab }),
  openNodePanel: (nodeId, tab = 'logs') => set({ selectedNodeId: nodeId, drawerTab: tab }),
  closeNodePanel: () => set({ selectedNodeId: null }),
  setCanvasTransform: (canvasTransform) => set({ canvasTransform }),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),
  updateNodePosition: (id, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === id ? { ...node, positionX: x, positionY: y } : node)),
    })),
  markNodeDeployQueued: (id, jobId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              status: 'BUILDING',
              jobId,
              statusMessage: 'deployment queued',
            }
          : node,
      ),
    })),
  loadNodes: async () => {
    const resApps = await api.get('/apps');
    const payload = resApps.data?.apps ?? resApps.data ?? [];

    const incoming = (Array.isArray(payload) ? payload : []).map((item: any, idx: number) => {
      // detect DeploymentRecord shape
      if (item && (item.DeploymentID || item.AppName || item.SourceRepoURL)) {
        return mapDeploymentToCanvasNode(item as DeploymentRecordDTO, idx);
      }

      // otherwise assume AppRecord shape
      return mapAppToCanvasNode(item as AppRecordDTO, idx);
    });

    // Merge backend state into the existing canvas instead of replacing it
    // wholesale. The mapped nodes carry default grid coordinates, but if we
    // already track a node we keep its current x/y so polling refreshes
    // status/metadata without snapping dragged nodes back to the grid.
    set((state) => {
      const existingById = new Map(state.nodes.map((node) => [node.id, node]));

      const nodes = incoming.map((node) => {
        const existing = existingById.get(node.id);
        if (!existing) return node;

        return {
          ...node,
          positionX: existing.positionX,
          positionY: existing.positionY,
          jobId:
            node.status === 'BUILDING' || node.status === 'FAILED'
              ? existing.jobId ?? node.jobId
              : null,
        };
      });

      return { nodes };
    });
  },
  fetchCanvasData: async () => {
    set({ loading: true, error: null });
    try {
      await useCanvasStore.getState().loadNodes();
      set({ loading: false });
    } catch (err: any) {
      console.error('fetchCanvasData failed', err);
      set({ loading: false, error: err?.message ? String(err.message) : String(err) });
    }
  },
  // lightweight polling for near-real-time inventory refresh
  startPollingNodes: (intervalMs = 5000) => {
    // Supersede any previously running loop (its run() will see a stale
    // generation and stop rescheduling itself).
    pollGeneration += 1;
    const generation = pollGeneration;
    // Throttle: surface one toast per failure streak, not one every interval.
    let notifiedPollFailure = false;

    const run = async () => {
      if (generation !== pollGeneration) return;
      try {
        await useCanvasStore.getState().loadNodes();
        notifiedPollFailure = false;
      } catch (err) {
        console.error('poll loadNodes failed', err);
        if (!notifiedPollFailure) {
          notifiedPollFailure = true;
          toast.error('Lost connection to the control plane. Retrying…', 'Connection lost');
        }
      }
      // Bail out if stopPollingNodes (or a newer startPollingNodes call) ran
      // while we were awaiting above, so we don't resurrect a stopped loop.
      if (generation !== pollGeneration) return;
      // Always write the *current* timer id to the shared handle so
      // stopPollingNodes can actually cancel the pending reschedule, not just
      // the very first one.
      (window as any).__canvas_polling_timer = window.setTimeout(run, intervalMs) as unknown as number;
    };

    if ((window as any).__canvas_polling_timer) {
      window.clearTimeout((window as any).__canvas_polling_timer);
    }
    (window as any).__canvas_polling_timer = window.setTimeout(run, 0) as unknown as number;
  },
  stopPollingNodes: () => {
    // Invalidate the loop so an in-flight run() won't reschedule after this.
    pollGeneration += 1;
    if ((window as any).__canvas_polling_timer) {
      window.clearTimeout((window as any).__canvas_polling_timer);
      (window as any).__canvas_polling_timer = null;
    }
  },
}));
