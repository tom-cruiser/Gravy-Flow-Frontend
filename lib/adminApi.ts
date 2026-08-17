// Typed client functions for the Admin Control Panel backend
// (GravyFlow-Backend-'s cmd/api/admin.go, admin_infra.go, admin_billing.go,
// admin_audit.go, admin_mfa.go). Reuses the shared `api` axios instance from
// lib/api.ts — no second HTTP client, no duplicate auth/refresh handling.
//
// Field casing note: most admin JSON responses are camelCase (Go struct json
// tags), but DeploymentRecord (db.go) has no json tags at all, so it and
// anything embedding it (AdminDeploymentSummary) serialize with Go's default
// capitalized field names. That's intentional upstream, not a typo here.
import { api } from './api';

// ---------------------------------------------------------------------------
// Module A: User & Team Administration
// ---------------------------------------------------------------------------

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  githubHandle: string;
  isAdmin: boolean;
  status: 'active' | 'suspended' | 'flagged' | 'deleted' | string;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  deploymentCount: number;
};

export type PaginatedAdminUsers = {
  items: AdminUserSummary[];
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type AdminUserFilters = {
  email?: string;
  userId?: string;
  workspace?: string;
  githubHandle?: string;
  page?: number;
  perPage?: number;
};

export type QuotaRecord = {
  userId: string;
  maxCpu: number;
  maxMemoryMb: number;
  maxApps: number;
  maxStorageMb: number;
  maxBandwidthGb: number;
  createdAt: string;
  updatedAt: string;
};

export type ResourceUsageRecord = {
  userId: string;
  currentCpu: number;
  currentMemoryMb: number;
  currentApps: number;
  currentStorageMb: number;
  updatedAt: string;
};

// DeploymentRecord has no json tags on the backend (see file header) — Go's
// default field-name casing applies.
export type DeploymentRecord = {
  DeploymentID: string;
  ProjectID: string;
  AppName: string;
  SourceRepoURL: string;
  AppPath: string;
  PortMap: string;
  ImageName: string;
  ContainerID: string;
  ContainerName: string;
  Status: string;
  StatusMessage: string;
  StartedAt: string | null;
  FinishedAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type AdminDeploymentSummary = DeploymentRecord & {
  ownerUserId: string;
  ownerEmail: string;
};

export type PaginatedAdminDeployments = {
  items: AdminDeploymentSummary[];
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type AdminUserDetail = {
  user: AdminUserSummary;
  teams: string[];
  quota: QuotaRecord;
  usage: ResourceUsageRecord;
  deployments: DeploymentRecord[];
  creditBalanceCents: number;
};

export function listUsers(filters: AdminUserFilters = {}) {
  return api.get<PaginatedAdminUsers>('/admin/users', { params: filters }).then((r) => r.data);
}

export function getUser(userId: string) {
  return api.get<AdminUserDetail>(`/admin/users/${userId}`).then((r) => r.data);
}

export type UserStatus = 'active' | 'suspended' | 'flagged' | 'deleted';

export function setUserStatus(userId: string, status: UserStatus, reason?: string) {
  return api.patch(`/admin/users/${userId}/status`, { status, reason }).then((r) => r.data);
}

export type DeleteMode = 'soft' | 'hard';

export function deleteUser(userId: string, mode: DeleteMode, reason?: string) {
  return api.post(`/admin/users/${userId}/delete`, { mode, reason }).then((r) => r.data);
}

export type ImpersonateResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  readOnly: true;
  user: { id: string; email: string; displayName: string; isAdmin: boolean; mfaEnabled: boolean };
};

export function impersonateUser(userId: string, reason?: string) {
  return api.post<ImpersonateResponse>(`/admin/users/${userId}/impersonate`, { reason }).then((r) => r.data);
}

// ---------------------------------------------------------------------------
// Module B: Infrastructure & Deployment Management
// ---------------------------------------------------------------------------

export type ClusterOverview = {
  activeContainers: number;
  totalDeployments: number;
  totalCpuCores: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  sampledAt: string;
  unreachableCount: number;
};

export function getClusterOverview() {
  return api.get<ClusterOverview>('/admin/cluster/overview').then((r) => r.data);
}

export function listDeployments(search = '', page = 1, perPage = 25) {
  return api
    .get<PaginatedAdminDeployments>('/admin/deployments', { params: { search, page, perPage } })
    .then((r) => r.data);
}

export function restartDeployment(deploymentId: string) {
  return api.post(`/admin/deployments/${deploymentId}/restart`).then((r) => r.data);
}

export function forceStopDeployment(deploymentId: string, reason?: string) {
  return api.post(`/admin/deployments/${deploymentId}/force-stop`, { reason }).then((r) => r.data);
}

export function purgeDeploymentCache(deploymentId: string) {
  return api.post(`/admin/deployments/${deploymentId}/purge-cache`).then((r) => r.data);
}

// Mirrors DeploymentEnvRecord (envs.go). value always renders masked here —
// adminGetDeploymentEnvHandler hardcodes includeSensitive=false regardless
// of who's asking (see admin_infra.go).
export type DeploymentEnvVar = {
  id?: string;
  deploymentId?: string;
  key: string;
  value?: string;
  category?: string;
  sensitive?: boolean;
  description?: string;
};

export function getDeploymentEnv(deploymentId: string) {
  return api
    .get<{ envVars: DeploymentEnvVar[]; count: number }>(`/admin/deployments/${deploymentId}/env`)
    .then((r) => r.data);
}

// ---------------------------------------------------------------------------
// Module C: Billing, Quotas & Abuse Control
// ---------------------------------------------------------------------------

export type QuotaPatch = {
  maxCpu?: number;
  maxMemoryMb?: number;
  maxApps?: number;
  maxStorageMb?: number;
  maxBandwidthGb?: number;
};

export function updateQuota(userId: string, patch: QuotaPatch) {
  return api.patch<QuotaRecord>(`/admin/users/${userId}/quota`, patch).then((r) => r.data);
}

export function restoreQuotaDefaults(userId: string) {
  return api.post<QuotaRecord>(`/admin/users/${userId}/quota/restore-defaults`).then((r) => r.data);
}

export function resetQuotaUsage(userId: string) {
  return api.post(`/admin/users/${userId}/quota/reset-usage`).then((r) => r.data);
}

export type QuotaHistoryEntry = {
  id: string;
  userId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  createdAt: string;
};

export function getQuotaHistory(userId: string) {
  return api
    .get<{ history: QuotaHistoryEntry[]; count: number }>(`/admin/users/${userId}/quota/history`)
    .then((r) => r.data);
}

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  amountCents: number;
  entryType: 'issue' | 'revoke';
  reason: string;
  issuedBy: string;
  createdAt: string;
};

export function getCreditBalance(userId: string) {
  return api
    .get<{ balanceCents: number; history: CreditLedgerEntry[] }>(`/admin/users/${userId}/credits`)
    .then((r) => r.data);
}

export function issueCredit(userId: string, amountCents: number, reason: string) {
  return api.post<CreditLedgerEntry>(`/admin/users/${userId}/credits/issue`, { amountCents, reason }).then((r) => r.data);
}

export function revokeCredit(userId: string, amountCents: number, reason: string) {
  return api.post<CreditLedgerEntry>(`/admin/users/${userId}/credits/revoke`, { amountCents, reason }).then((r) => r.data);
}

export type RiskAlert = {
  id: string;
  userId: string;
  userEmail: string;
  deploymentId: string | null;
  appName?: string;
  riskScore: number;
  reason: string;
  status: 'open' | 'resolved' | string;
  createdAt: string;
  resolvedAt: string | null;
};

export function listRiskAlerts(status?: string) {
  return api
    .get<{ alerts: RiskAlert[]; count: number }>('/admin/risk-alerts', { params: status ? { status } : undefined })
    .then((r) => r.data);
}

export function isolateRiskAlert(alertId: string, deploymentId?: string) {
  return api
    .post(`/admin/risk-alerts/${alertId}/isolate`, undefined, {
      params: deploymentId ? { deploymentId } : undefined,
    })
    .then((r) => r.data);
}

// ---------------------------------------------------------------------------
// Module D: System Audit Logs
// ---------------------------------------------------------------------------

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
};

export type AuditLogFilters = {
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  page?: number;
  perPage?: number;
};

export function listAuditLogs(filters: AuditLogFilters = {}) {
  return api
    .get<{ items: AuditLogEntry[]; totalCount: number; page: number; perPage: number; totalPages: number }>(
      '/admin/audit-logs',
      { params: filters },
    )
    .then((r) => r.data);
}

// ---------------------------------------------------------------------------
// MFA enrollment (technically under /auth, not /admin — see admin_mfa.go —
// but it's admin-only and only relevant to the admin panel, so it lives here
// rather than in the generic lib/api.ts).
// ---------------------------------------------------------------------------

export function mfaEnroll() {
  return api.post<{ secret: string; provisioningUri: string }>('/auth/mfa/enroll').then((r) => r.data);
}

export function mfaEnable(code: string) {
  return api.post<{ message: string }>('/auth/mfa/enable', { code }).then((r) => r.data);
}

// ---------------------------------------------------------------------------
// MFA disable / recovery codes. Self-service in the backend (any user could
// call these), but in practice admin-only: mfaEnrollHandler above is the
// only way to ever turn MFA on, and it explicitly rejects non-admins, so a
// regular user's MFAEnabled is always false and these just 409. Password
// change, which IS exposed to regular users, now lives in lib/profileApi.ts
// instead — see that file's header for why.
// ---------------------------------------------------------------------------

export function disableMFA(currentPassword: string) {
  return api.post<{ message: string }>('/profile/mfa/disable', { currentPassword }).then((r) => r.data);
}

export function regenerateRecoveryCodes() {
  return api.post<{ codes: string[] }>('/profile/mfa/recovery-codes/regenerate').then((r) => r.data);
}
