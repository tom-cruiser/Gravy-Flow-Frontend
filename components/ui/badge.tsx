import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Status semantics follow the rest of the app's convention (LogViewer,
// DomainManager): emerald = healthy/active, amber = pending/flagged,
// rose = error/suspended/deleted, brand = neutral/informational.
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-brand-600/60 bg-brand-800/60 text-zinc-300',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        destructive: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
        accent: 'border-accent/30 bg-accent/10 text-brand-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
