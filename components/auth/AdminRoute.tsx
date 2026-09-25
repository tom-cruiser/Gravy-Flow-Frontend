'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const MFA_SETUP_PATH = '/admin/mfa-setup';

type AdminRouteProps = {
  children: React.ReactNode;
};

// Same hydration-guard + redirect shape as ProtectedRoute, plus an isAdmin
// check that sends non-admins back to the regular dashboard, and an MFA check
// that holds admins at /admin/mfa-setup until they enroll. This is a UX guard
// only — the real boundary is server-side (AdminMiddleware in the backend's
// auth.go requires an MFA-verified session; lib/api.ts handles its 403).
export function AdminRoute({ children }: AdminRouteProps) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const pathname = usePathname();
  const needsMfaSetup = Boolean(user?.isAdmin && !user.mfaEnabled && pathname !== MFA_SETUP_PATH);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (!user?.isAdmin) {
      router.replace('/dashboard');
      return;
    }
    if (needsMfaSetup) {
      router.replace(MFA_SETUP_PATH);
    }
  }, [accessToken, hasHydrated, user, router, needsMfaSetup]);

  if (!hasHydrated || !accessToken || !user?.isAdmin || needsMfaSetup) {
    return <div className="min-h-screen bg-brand-950" />;
  }

  return <>{children}</>;
}
