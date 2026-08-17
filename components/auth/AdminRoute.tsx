'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

type AdminRouteProps = {
  children: React.ReactNode;
};

// Same hydration-guard + redirect shape as ProtectedRoute, plus an isAdmin
// check that sends non-admins back to the regular dashboard. This is a UX
// guard only — the real boundary is server-side (AdminMiddleware in the
// backend's auth.go). MFA is opt-in, not required for admin access, so this
// guard doesn't check mfaEnabled — /admin/mfa-setup is reachable voluntarily
// via the sidebar's "Security" link, not forced.
export function AdminRoute({ children }: AdminRouteProps) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (!user?.isAdmin) {
      router.replace('/dashboard');
    }
  }, [accessToken, hasHydrated, user, router]);

  if (!hasHydrated || !accessToken || !user?.isAdmin) {
    return <div className="min-h-screen bg-brand-950" />;
  }

  return <>{children}</>;
}
