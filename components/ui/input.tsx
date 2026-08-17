import * as React from 'react';

import { cn } from '@/lib/utils';

// Same visual spec as the existing .gf-input utility class (globals.css),
// expressed as a component so it composes with Shadcn form primitives.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-gf border border-brand-700/80 bg-brand-800/60 px-4 py-2 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50',
        'focus:border-accent focus:ring-1 focus:ring-accent/40',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
