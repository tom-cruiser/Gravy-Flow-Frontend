import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-brand-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-page-glow" />
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-auth-visual opacity-40 md:block" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <p className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Image src="/logo-mark-white.png" alt="GravyFlow" width={18} height={32} priority />
          Gravy<span className="text-brand-300">Flow</span>
        </p>
        <div className="flex items-center gap-3">
          <Link href="/login" className="gf-btn-ghost text-sm">
            Log in
          </Link>
          <Link href="/register" className="hidden rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-glow-accent transition hover:bg-accent-hover sm:inline-flex">
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 text-center sm:px-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-brand-300">Deployment control plane</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Infrastructure canvas for modern deployments.
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Map services on a live canvas, stream logs, manage secrets, and attach custom domains — all from one unified workspace.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-gf bg-accent px-6 py-3 text-sm font-semibold text-white shadow-glow-accent transition hover:bg-accent-hover">
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="gf-btn-outline px-6">
            Open dashboard
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-brand-700/30 px-6 py-5 text-center text-xs text-zinc-500 sm:px-10">
        Deploy repos · Manage env vars · Verify domains
      </footer>
    </main>
  );
}
