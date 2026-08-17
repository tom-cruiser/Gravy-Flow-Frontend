'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const SLIDES = [
  {
    tagline: 'Deploying services, creating infrastructure.',
    caption: 'Map your stack on a live canvas and ship with confidence.',
  },
  {
    tagline: 'From repo to runtime in minutes.',
    caption: 'Connect Git, configure env vars, and go live on custom domains.',
  },
  {
    tagline: 'Built for modern control planes.',
    caption: 'Logs, secrets, and DNS — all in one unified workspace.',
  },
];

type AuthShellProps = {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function AuthShell({ children, backHref = '/', backLabel = 'Back to website' }: AuthShellProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const slide = SLIDES[activeSlide];

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-950 px-4 py-8 text-zinc-100">
      <div className="grid w-full max-w-[1100px] overflow-hidden rounded-[1.75rem] border border-brand-700/40 bg-brand-850/50 shadow-panel md:grid-cols-[1.05fr_0.95fr]">
        {/* Visual panel */}
        <section className="relative hidden min-h-[640px] flex-col justify-between bg-auth-visual p-10 md:flex">
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Image src="/logo-mark-white.png" alt="GravyFlow" width={20} height={36} priority />
              Gravy<span className="text-brand-300">Flow</span>
            </Link>
            <Link href={backHref} className="gf-btn-ghost gap-1.5 text-xs">
              {backLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            <p className="max-w-sm text-2xl font-semibold leading-snug text-white transition-opacity duration-500">
              {slide.tagline}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-zinc-400">{slide.caption}</p>
          </div>

          <div className="flex items-center gap-2">
            {SLIDES.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show slide ${index + 1}`}
                onClick={() => setActiveSlide(index)}
                className={`h-1 rounded-full transition-all ${
                  index === activeSlide ? 'w-8 bg-white' : 'w-4 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center bg-brand-900/90 px-8 py-10 sm:px-12 sm:py-14">
          <div className="w-full max-w-[380px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
