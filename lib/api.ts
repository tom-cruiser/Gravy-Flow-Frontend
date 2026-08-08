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

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  const isAuthEndpoint = config.url?.startsWith('/auth/');
  if (token && !isAuthEndpoint) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    // Never try to refresh for auth endpoints themselves
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');

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
