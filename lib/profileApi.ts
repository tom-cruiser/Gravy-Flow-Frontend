// Self-service account management — password + subscription plan — for ANY
// authenticated user, admin or not. Distinct from lib/adminApi.ts, which is
// specifically for the Admin Control Panel acting on OTHER users' accounts;
// these endpoints (GravyFlow-Backend-'s cmd/api/admin_profile.go and
// billing_plans.go) only ever act on the caller's own account, which is why
// they're registered under the generic /api/v1 group, not /admin, despite
// the Go handler names still starting with "admin" for historical reasons.
import { api } from './api';

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

export type ChangePasswordResult = {
  message: string;
  sessionsRevoked: boolean;
  // Present only when logoutOtherDevices was true — the backend revokes
  // every refresh token for the account (including this session's) and
  // re-issues a fresh pair in the same response so the caller isn't logged
  // out by their own request. The caller must feed these into
  // useAuthStore's setSession.
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type PasswordChangeError = {
  error: 'invalid_current_password' | 'weak_password' | 'password_reuse' | string;
  violations?: string[];
  details?: string;
};

export function changePassword(currentPassword: string, newPassword: string, logoutOtherDevices: boolean) {
  return api
    .post<ChangePasswordResult>('/profile/password', {
      currentPassword,
      newPassword,
      logoutOtherDevices,
    })
    .then((r) => r.data);
}

// ---------------------------------------------------------------------------
// Subscription plan (self-service quota tier — see billing_plans.go for why
// this is not a real checkout: no payment processor is wired into this
// codebase, so "upgrading" only changes quota limits, nothing is charged).
// ---------------------------------------------------------------------------

export type BillingPlan = {
  key: string;
  name: string;
  priceDisplay: string;
  maxCpu: number;
  maxMemoryMb: number;
  maxApps: number;
  maxStorageMb: number;
  maxBandwidthGb: number;
};

export function listBillingPlans() {
  return api.get<{ plans: BillingPlan[] }>('/billing/plans').then((r) => r.data.plans);
}

export type QuotaRecord = {
  userId: string;
  maxCpu: number;
  maxMemoryMb: number;
  maxApps: number;
  maxStorageMb: number;
  maxBandwidthGb: number;
  plan: string;
  createdAt: string;
  updatedAt: string;
};

export function upgradePlan(plan: string) {
  return api.post<QuotaRecord>('/billing/plan', { plan }).then((r) => r.data);
}

// Mirrors QuotaWidget.tsx's local QuotaSummary shape (that component calls
// the same GET /users/:id/quota inline rather than through this module) —
// duplicated here, not imported from there, since that type isn't exported.
export type QuotaSummary = {
  quota: QuotaRecord;
  usage: {
    userId: string;
    currentCpu: number;
    currentMemoryMb: number;
    currentApps: number;
    currentStorageMb: number;
  };
  available: QuotaRecord;
};

export function getQuotaSummary(userId: string) {
  return api.get<QuotaSummary>(`/users/${userId}/quota`).then((r) => r.data);
}
