'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastVariant } from '@/store/toastStore';

const variantConfig: Record<
  ToastVariant,
  { Icon: typeof Info; iconClass: string; border: string; glow: string }
> = {
  success: { Icon: CheckCircle2, iconClass: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.08)]' },
  error: { Icon: AlertCircle, iconClass: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_30px_rgba(244,63,94,0.1)]' },
  warning: { Icon: AlertTriangle, iconClass: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.08)]' },
  info: { Icon: Info, iconClass: 'text-accent', border: 'border-accent/30', glow: 'shadow-[0_0_30px_rgba(118,56,250,0.12)]' },
};

const EXIT_ANIMATION_MS = 200;

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => dismiss(toast.id), EXIT_ANIMATION_MS);
  }, [dismiss, toast.id]);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(close, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, close]);

  const { Icon, iconClass, border, glow } = variantConfig[toast.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-gf-2xl border ${border} ${glow} bg-brand-900/90 p-4 shadow-panel backdrop-blur ${
        leaving
          ? 'animate-out fade-out slide-out-to-right-4 duration-200'
          : 'animate-in fade-in slide-in-from-bottom-4 duration-200'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-sm font-semibold text-zinc-100">{toast.title}</p> : null}
        <p className="break-words text-sm text-zinc-300">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

// Store-backed, so children render normally and the viewport overlays them.
// No React context is needed — the store is the single source of truth, which
// is what lets non-React callers (axios interceptor) push toasts too.
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
