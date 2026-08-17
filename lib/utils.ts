import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard Shadcn helper: merges conditional class lists (clsx) then resolves
// conflicting Tailwind utility classes (tailwind-merge) so later classes in
// a component's className prop correctly override earlier ones.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
