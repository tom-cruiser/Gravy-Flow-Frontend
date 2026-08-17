import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Standard Shadcn button, restyled onto this app's existing brand/accent
// tokens (tailwind.config.ts) and gf radii instead of Shadcn's default theme,
// so it reads as the same component family as .gf-btn-primary etc.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-gf text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-accent/40',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white shadow-glow-accent hover:bg-accent-hover active:scale-[0.98]',
        destructive: 'bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.98]',
        outline:
          'border border-brand-600/80 bg-transparent text-zinc-300 hover:border-brand-500 hover:bg-brand-800/40 hover:text-zinc-100',
        ghost: 'text-zinc-300 hover:bg-brand-800/60 hover:text-zinc-100',
        link: 'text-brand-300 underline underline-offset-4 hover:text-brand-200',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-gf px-3 text-xs',
        lg: 'h-11 rounded-gf px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
