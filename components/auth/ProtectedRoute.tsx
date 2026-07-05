'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [accessToken, hasHydrated, router]);

  if (!hasHydrated) {
    return <div className="min-h-screen bg-brand-950" />;
  }

  if (!accessToken) {
    return <div className="min-h-screen bg-brand-950" />;
  }

  return <>{children}</>;
}
