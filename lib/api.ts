import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

function notifySessionExpired() {
  toast.error(SESSION_EXPIRED_MESSAGE, 'Session expired');
}

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetriableRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

// The /auth endpoints that run before a session exists. They must not carry
// a (possibly stale) bearer token or trigger a refresh. Every other /auth
// route — mfa/enroll, mfa/enable, api-keys, logout — requires the session.
const PUBLIC_AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/mfa/verify']);

function isPublicAuthEndpoint(url: string | undefined): boolean {
  return url !== undefined && PUBLIC_AUTH_ENDPOINTS.has(url.split('?')[0]);
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !isPublicAuthEndpoint(config.url)) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    // Never try to refresh for the pre-session auth endpoints themselves
    const isAuthEndpoint = isPublicAuthEndpoint(originalRequest?.url);

    // AdminMiddleware refuses admin sessions that didn't pass MFA. Not
    // enrolled → go enroll; enrolled but this session predates the factor
    // (e.g. signed in before MFA was enforced) → sign in again with the code.
    const errorBody = error.response?.data as { error?: string; mfaEnrolled?: boolean } | undefined;
    if (error.response?.status === 403 && errorBody?.error === 'mfa_required' && typeof window !== 'undefined') {
      if (errorBody.mfaEnrolled) {
        toast.error('Sign in again with your authenticator code to use the admin panel.', 'Verification required');
        useAuthStore.getState().clearSession();
        window.location.assign('/login');
      } else {
        useAuthStore.getState().patchUser({ mfaEnabled: false });
        if (window.location.pathname !== '/admin/mfa-setup') window.location.assign('/admin/mfa-setup');
      }
      return Promise.reject(error);
    }

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      notifySessionExpired();
      useAuthStore.getState().clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient
          .post('/auth/refresh', { refreshToken })
          .then((response) => {
            const nextAccessToken = response.data?.accessToken ?? null;
            const nextRefreshToken = response.data?.refreshToken ?? refreshToken;
            const nextUser = response.data?.user ?? null;

            if (nextAccessToken) {
              useAuthStore.getState().setAccessToken(nextAccessToken);
            }
            if (nextRefreshToken) {
              useAuthStore.getState().setRefreshToken(nextRefreshToken);
            }
            if (nextUser) {
              useAuthStore.setState({ user: nextUser });
            }

            return nextAccessToken;
          })
          .catch((refreshError) => {
            notifySessionExpired();
            useAuthStore.getState().clearSession();
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const nextAccessToken = await refreshPromise;
      if (!nextAccessToken) {
        useAuthStore.getState().clearSession();
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);
