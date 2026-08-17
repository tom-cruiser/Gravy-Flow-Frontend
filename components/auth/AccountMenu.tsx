'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function AccountMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!hasHydrated || !user) return null;

  const displayName = user.displayName?.trim() || user.email;
  const initial = (displayName || '?').charAt(0).toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    clearSession();
    router.replace('/login');
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 left-6 z-20">
      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="mb-2 w-64 overflow-hidden rounded-gf-2xl border border-brand-700/50 bg-brand-900/95 shadow-panel backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="border-b border-brand-700/50 px-4 py-3">
            <p className="truncate text-sm font-medium text-zinc-100">{user.displayName?.trim() || 'Account'}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          {user.isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-zinc-200 transition-colors hover:bg-brand-800/60"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-300" />
              Admin panel
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex max-w-[14rem] items-center gap-3 rounded-full border border-brand-700/60 bg-brand-900/90 py-2 pl-2 pr-4 text-left shadow-panel backdrop-blur transition-colors hover:border-brand-500"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-brand-200">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-100">{displayName}</span>
        </span>
      </button>
    </div>
  );
}
