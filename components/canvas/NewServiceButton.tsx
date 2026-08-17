'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCanvasStore } from '@/store/canvasStore';
import { parseContainerPort } from '@/lib/portMap';

function centerCanvasPoint() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function worldPointFromScreen(screenX: number, screenY: number, viewportX: number, viewportY: number, scale: number) {
  return {
    x: (screenX - viewportX) / scale,
    y: (screenY - viewportY) / scale,
  };
}

export function NewServiceButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const user = useAuthStore((state) => state.user);
  const canvasTransform = useCanvasStore((state) => state.canvasTransform);
  const addNode = useCanvasStore((state) => state.addNode);
  const openNodePanel = useCanvasStore((state) => state.openNodePanel);

  const buttonLabel = useMemo(() => (isSubmitting ? 'Provisioning…' : 'New Service'), [isSubmitting]);

  const openModal = () => {
    setErrorMessage(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setServiceName('');
    setRepositoryUrl('');
    setErrorMessage(null);
  };

  // Keyboard accessibility: Escape dismisses, and Tab/Shift+Tab is trapped so
  // focus cycles within the dialog instead of escaping to the canvas behind it.
  useEffect(() => {
    if (!isOpen) return;

    const getFocusable = (): HTMLElement[] => {
      const root = modalRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const outside = !modalRef.current?.contains(active);

      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  // Restore focus to the trigger when the modal closes (open -> closed only, so
  // it doesn't fire while submitting toggles state).
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const name = serviceName.trim();
    const repo = repositoryUrl.trim();
    if (!name || !repo) {
      setErrorMessage('Service name and repository URL are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/apps', { name, repo });

      if (response.status < 200 || response.status >= 300) {
        throw new Error('Provisioning was not accepted by the control plane.');
      }

      const { x: screenX, y: screenY } = centerCanvasPoint();
      const center = worldPointFromScreen(screenX, screenY, canvasTransform.viewportX, canvasTransform.viewportY, canvasTransform.scale);
      const internalPort = parseContainerPort(response.data?.app?.portMap ?? '8080:8080');
      const deploymentId = response.data?.deploymentId ?? crypto.randomUUID();
      const jobId = response.data?.jobId ?? null;

      addNode({
        id: deploymentId,
        name,
        type: 'web',
        status: 'BUILDING',
        positionX: center.x,
        positionY: center.y,
        internalPort,
        repo,
        jobId,
      });
      openNodePanel(deploymentId, 'logs');
      setIsOpen(false);
      setServiceName('');
      setRepositoryUrl('');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create service.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Primary Floating Action Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/30 bg-accent px-6 py-3 text-sm font-semibold text-zinc-900 shadow-glow-accent transition-all hover:bg-accent-hover active:scale-[0.98]"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        {buttonLabel}
      </button>

      {isOpen && (
        /* Modal Backdrop Overlay with backdrop click handler for intuitive dismiss */
        <div 
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div 
            ref={modalRef}
            className="w-full max-w-lg rounded-[1.75rem] border border-brand-700/50 bg-brand-900/95 p-8 text-zinc-100 shadow-panel animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-service-title"
            aria-describedby="new-service-desc"
          >
            {/* Header Block Container */}
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-300">Dynamic Provisioning</p>
                <h2 id="new-service-title" className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">Create a new service</h2>
                <p id="new-service-desc" className="mt-1 text-sm text-zinc-400">Submit metadata parameters to coordinate canvas node deployment profiles.</p>
              </div>
              
              {/* Clean Icon X Button instead of redundant text */}
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-full border border-brand-700 bg-brand-800/50 p-2 text-zinc-400 transition-colors hover:border-brand-600 hover:text-zinc-100 disabled:opacity-40"
                aria-label="Close configuration modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message Layout Isolation */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in duration-150">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Input Group: Service Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="serviceName" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  Service Name
                </label>
                <input
                  id="serviceName"
                  autoFocus
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="payments-api"
                  className="gf-input font-normal normal-case tracking-normal"
                  required
                />
              </div>

              {/* Input Group: Git Repository */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="repositoryUrl" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  Git Repository URL
                </label>
                <input
                  id="repositoryUrl"
                  type="url"
                  value={repositoryUrl}
                  // FIXED: Changed event.target.trim() to event.target.value.trim()
                  onChange={(event) => setRepositoryUrl(event.target.value.trim())}
                  placeholder="https://github.com/org/repo"
                  className="gf-input font-normal normal-case tracking-normal"
                  required
                />
              </div>

              {/* Footer Controls Component */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-gf border border-brand-700 bg-brand-800/50 px-5 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-brand-600 hover:text-zinc-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gf-btn-primary w-auto px-5 py-2.5 disabled:opacity-40"
                >
                  {isSubmitting ? 'Provisioning…' : `Deploy as ${user?.displayName || 'User'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}