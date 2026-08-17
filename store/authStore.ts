import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  // Populated by the backend's AuthUserResponse (see GravyFlow-Backend-'s
  // auth.go) so the admin panel can be gated client-side without decoding
  // the JWT. isAdmin gates access to /admin/*; mfaEnabled tells the login
  // flow whether to show the TOTP step and lets /admin/mfa-setup know
  // whether enrollment is still needed (the backend also enforces this
  // server-side via AdminMiddleware, so this is a UX shortcut, not the
  // security boundary).
  isAdmin: boolean;
  mfaEnabled: boolean;
};

// Shape returned by POST /auth/login and POST /auth/register.
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (session: { accessToken: string; refreshToken?: string | null; user: AuthUser }) => void;
  setAccessToken: (accessToken: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  // Patches fields on the current user without touching tokens — used by the
  // MFA enrollment flow to flip mfaEnabled to true immediately after
  // POST /auth/mfa/enable succeeds, without forcing a re-login.
  patchUser: (patch: Partial<AuthUser>) => void;
  clearSession: () => void;
  markHydrated: () => void;
};

const storage = typeof window === 'undefined' ? undefined : createJSONStorage(() => window.localStorage);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setSession: ({ accessToken, refreshToken = null, user }) =>
        set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      patchUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'gravyflow-auth',
      storage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
