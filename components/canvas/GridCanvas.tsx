'use client';

import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { NetworkLine } from './NetworkLine';
import { ServiceNode } from './ServiceNode';

type Point = { x: number; y: number };

// Matched with our newly optimized ServiceNode bounds (260x160 safe target area)
const NODE_WIDTH = 260;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

// Connection lines are hidden until the backend models real node-to-node
// relationships. Today they'd draw every db↔web pair (a cartesian product),
// which misrepresents the actual topology. Flip to true to restore.
const SHOW_CONNECTIONS = false;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function GridCanvas() {
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const drawerTab = useCanvasStore((state) => state.drawerTab);
  const openNodePanel = useCanvasStore((state) => state.openNodePanel);
  const closeNodePanel = useCanvasStore((state) => state.closeNodePanel);
  const setCanvasTransform = useCanvasStore((state) => state.setCanvasTransform);
  const updateNodePosition = useCanvasStore((state) => state.updateNodePosition);
  const fetchCanvasData = useCanvasStore((state) => state.fetchCanvasData);
  const startPollingNodes = useCanvasStore((state) => state.startPollingNodes);
  const stopPollingNodes = useCanvasStore((state) => state.stopPollingNodes);
  const loading = useCanvasStore((state) => state.loading);
  const error = useCanvasStore((state) => state.error);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Point>({ x: 120, y: 150 });
  const [scale, setScale] = useState(1);
  const [dragState, setDragState] = useState<
    | { mode: 'pan'; pointerId: number; originX: number; originY: number; startX: number; startY: number }
    | {
        mode: 'node';
        pointerId: number;
        id: string;
        offsetX: number;
        offsetY: number;
        originX: number;
        originY: number;
      }
    | null
  >(null);

  const CLICK_DRAG_THRESHOLD_PX = 6;

  // SVG Connection Path Generation Matrix (Now computed on stable world space, ignoring layout reflows)
  const connectionPaths = useMemo(() => {
    const webNodes = nodes.filter((node) => node.type === 'web');
    const dbNodes = nodes.filter((node) => node.type === 'db');

    return dbNodes.flatMap((dbNode) => {
      return webNodes.map((webNode) => {
        // Calculate points relative to pure world positions, bypassing real-time viewport mutations
        const startX = dbNode.positionX;
        const startY = dbNode.positionY;
        const endX = webNode.positionX - NODE_WIDTH / 2;
        const endY = webNode.positionY;
        
        const bend = Math.max(100, Math.abs(endX - startX) * 0.5);
        const d = `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;

        return {
          id: `${dbNode.id}-${webNode.id}`,
          d,
          highlighted: dbNode.id === selectedNodeId || webNode.id === selectedNodeId,
        };
      });
    });
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    setCanvasTransform({ viewportX: viewport.x, viewportY: viewport.y, scale });
  }, [scale, setCanvasTransform, viewport.x, viewport.y]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!active) return;
        await fetchCanvasData();
      } catch (err) {
        // Error tracking managed by state machine
      }
    })();

    startPollingNodes(5000);

    return () => {
      active = false;
      stopPollingNodes();
    };
  }, []);

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      if (!dragState) return;

      if (dragState.mode === 'pan') {
        const dx = event.clientX - dragState.originX;
        const dy = event.clientY - dragState.originY;
        setViewport({ x: dragState.startX + dx, y: dragState.startY + dy });
      }

      if (dragState.mode === 'node') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        
        // Exact coordinate mapping onto scaled coordinate systems
        const nextX = (event.clientX - rect.left - viewport.x) / scale - dragState.offsetX;
        const nextY = (event.clientY - rect.top - viewport.y) / scale - dragState.offsetY;
        updateNodePosition(dragState.id, nextX, nextY);
      }
    };

    const handleUp = (event: globalThis.PointerEvent) => {
      if (dragState && dragState.pointerId === event.pointerId) {
        if (dragState.mode === 'node') {
          const moved = Math.hypot(event.clientX - dragState.originX, event.clientY - dragState.originY);
          if (moved <= CLICK_DRAG_THRESHOLD_PX) {
            const node = nodes.find((entry) => entry.id === dragState.id);
            const tab =
              node?.status === 'BUILDING' || node?.status === 'FAILED'
                ? 'logs'
                : selectedNodeId === dragState.id
                  ? drawerTab
                  : 'logs';
            openNodePanel(dragState.id, tab);
          }
        }
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragState, drawerTab, nodes, openNodePanel, scale, selectedNodeId, updateNodePosition, viewport]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;

    closeNodePanel();
    setDragState({
      mode: 'pan',
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startX: viewport.x,
      startY: viewport.y,
    });
  };

  const handleNodePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const node = nodes.find((entry) => entry.id === id);
    if (!node) return;

    const rect = canvas.getBoundingClientRect();
    setDragState({
      mode: 'node',
      pointerId: event.pointerId,
      id,
      offsetX: (event.clientX - rect.left - viewport.x) / scale - node.positionX,
      offsetY: (event.clientY - rect.top - viewport.y) / scale - node.positionY,
      originX: event.clientX,
      originY: event.clientY,
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    
    const worldX = (pointer.x - viewport.x) / scale;
    const worldY = (pointer.y - viewport.y) / scale;
    
    const nextScale = clamp(scale - event.deltaY * 0.0015, MIN_SCALE, MAX_SCALE);

    setScale(nextScale);
    setViewport({
      x: pointer.x - worldX * nextScale,
      y: pointer.y - worldY * nextScale,
    });
  };

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onWheel={handleWheel}
      className="relative h-screen w-screen overflow-hidden bg-brand-950 text-zinc-100 select-none touch-none"
    >
      {/* Dynamic Background Grid: 
        backgroundPosition tracks viewport pan, backgroundSize tracks scale zoom dynamically.
      */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1.2px, transparent 1.2px)',
          backgroundSize: `${18 * scale}px ${18 * scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      {loading ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-gf-2xl border border-brand-700/50 bg-brand-900/90 px-6 py-5 shadow-panel">
            <div className="h-10 w-10 rounded-full border-4 border-brand-700 border-t-accent animate-spin" />
            <p className="text-sm text-zinc-200 font-medium mt-2">Initializing Canvas Architecture…</p>
            {error && <p className="max-w-xs text-center text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_35%)]" />

          {/* Unified Canvas Workspace:
            Transforms entire viewport using high-performance 3D matrix.
            Bypasses real-time SVG line coordinates re-calculations completely.
          */}
          <div
            className="absolute inset-0 will-change-transform origin-top-left"
            style={{
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${scale})`,
            }}
          >
            {/* Connection Layer */}
            {SHOW_CONNECTIONS ? (
              <svg className="pointer-events-none absolute inset-0 overflow-visible h-full w-full">
                {connectionPaths.map((line) => (
                  <NetworkLine key={line.id} d={line.d} highlighted={line.highlighted} />
                ))}
              </svg>
            ) : null}

            {/* Nodes Layer */}
            <div className="absolute inset-0 pointer-events-none">
              {nodes.map((node) => (
                <ServiceNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeId === node.id}
                  onPointerDown={handleNodePointerDown}
                />
              ))}
            </div>
          </div>

          {/* Persistent Onboarding HUD HUD */}
          <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm rounded-gf-2xl border border-brand-700/50 bg-brand-900/70 px-4 py-3 shadow-panel backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-300">Deployment Canvas</p>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Drag workspace to pan, scroll to scale viewport. Select and drag live nodes to map routing infrastructure configurations.
            </p>
          </div>
        </>
      )}
    </div>
  );
}