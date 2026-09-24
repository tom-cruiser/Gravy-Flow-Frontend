// Typed client functions for custom-domain management and edge settings
// (GravyFlow-Backend-'s cmd/api/domain_handlers.go). Reuses the shared `api`
// axios instance from lib/api.ts, same as lib/adminApi.ts — no second HTTP
// client, no duplicate auth/refresh handling. Centralizing these calls here
// (instead of inline api.get/post in the component, as DomainManager.tsx
// used to do) is what makes the structured-error-message fix below possible:
// every caller gets the same shape to read errors from.
import { api } from './api';

export type DomainStatus = 'pending_dns' | 'dns_verified' | 'ssl_provisioning' | 'active' | 'error';

export type DomainRecord = {
  id: string;
  deploymentId: string;
  projectId: string;
  customDomain: string;
  verified: boolean;
  verificationToken?: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  status: DomainStatus;
  statusMessage?: string;
  isPrimary: boolean;
  dnsCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WWWRedirectMode = 'none' | 'apex_to_www' | 'www_to_apex';

export type EdgeSettings = {
  forceHttps: boolean;
  wwwRedirectMode: WWWRedirectMode;
};

export type AddDomainResult = {
  domain: DomainRecord;
  status: 'pending' | 'verified';
  challenge?: string;
  instruction?: string;
};

export type VerifyDomainResult = {
  domain: DomainRecord;
  status: string;
};

// Reads a structured backend error ({error, details}, sent by every handler
// in domain_handlers.go) the same way lib/adminQueries.ts's errorMessage()
// does — falls back to a generic message only when the response truly has
// no structured body (network failure, non-JSON error page, etc).
export function domainErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string; details?: string } } };
  const details = axiosErr?.response?.data?.details;
  const code = axiosErr?.response?.data?.error;
  if (details) return details;
  if (code) return code.replace(/_/g, ' ');
  return fallback;
}

export function listDomains(deploymentId: string) {
  return api.get<{ domains: DomainRecord[]; count: number }>(`/apps/${deploymentId}/domains`).then((r) => r.data);
}

export function addDomain(deploymentId: string, customDomain: string) {
  return api.post<AddDomainResult>(`/apps/${deploymentId}/domains`, { customDomain }).then((r) => ({
    ...r.data,
    // ShouldBindJSON's 202 (pending, manual verification) vs 200 (auto-verified)
    // both land here; the caller only needs to know the domain + whether it
    // still needs a DNS instructions panel, which domain.status already says.
    httpStatus: r.status,
  }));
}

export function verifyDomain(deploymentId: string, customDomain: string) {
  return api
    .post<VerifyDomainResult>(`/apps/${deploymentId}/domains/${encodeURIComponent(customDomain)}/verify`)
    .then((r) => r.data);
}

export function deleteDomain(deploymentId: string, customDomain: string) {
  return api.delete(`/apps/${deploymentId}/domains/${encodeURIComponent(customDomain)}`).then((r) => r.data);
}

export function makeDomainPrimary(deploymentId: string, customDomain: string) {
  return api
    .patch<{ domain: DomainRecord }>(`/apps/${deploymentId}/domains/${encodeURIComponent(customDomain)}/primary`)
    .then((r) => r.data.domain);
}

export function getEdgeSettings(deploymentId: string) {
  return api.get<{ edgeSettings: EdgeSettings }>(`/apps/${deploymentId}/edge-settings`).then((r) => r.data.edgeSettings);
}

export function updateEdgeSettings(deploymentId: string, settings: EdgeSettings) {
  return api
    .patch<{ edgeSettings: EdgeSettings }>(`/apps/${deploymentId}/edge-settings`, settings)
    .then((r) => r.data.edgeSettings);
}
