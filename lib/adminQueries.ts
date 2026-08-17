// React Query hooks wrapping lib/adminApi.ts. Query keys are namespaced per
// resource so a mutation only has to invalidate the slice it actually
// changed (e.g. changing a user's status invalidates the user list + that
// user's own detail query, not every admin query in the app).
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from './adminApi';
import { toast } from '@/store/toastStore';

function errorMessage(err: unknown, fallback: string) {
  const axiosErr = err as { response?: { data?: { error?: string; details?: string } } };
  const details = axiosErr?.response?.data?.details;
  const code = axiosErr?.response?.data?.error;
  if (details) return details;
  if (code) return code.replace(/_/g, ' ');
  return fallback;
}

// ---------------------------------------------------------------------------
// Module A: Users
// ---------------------------------------------------------------------------

export function useUsersQuery(filters: adminApi.AdminUserFilters) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => adminApi.listUsers(filters),
    placeholderData: (prev) => prev,
  });
}

export function useUserDetailQuery(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUser(userId as string),
    enabled: !!userId,
  });
}

export function useSetUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: adminApi.UserStatus; reason?: string }) =>
      adminApi.setUserStatus(userId, status, reason),
    onSuccess: (_data, vars) => {
      toast.success(`Status set to ${vars.status}`, 'User updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', vars.userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to update status'), 'Error'),
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, mode, reason }: { userId: string; mode: adminApi.DeleteMode; reason?: string }) =>
      adminApi.deleteUser(userId, mode, reason),
    onSuccess: (_data, vars) => {
      toast.success(vars.mode === 'hard' ? 'User permanently deleted' : 'User soft-deleted', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete user'), 'Error'),
  });
}

export function useImpersonateUserMutation() {
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => adminApi.impersonateUser(userId, reason),
    onError: (err) => toast.error(errorMessage(err, 'Failed to start impersonation'), 'Error'),
  });
}

// ---------------------------------------------------------------------------
// Module B: Infrastructure
// ---------------------------------------------------------------------------

export function useClusterOverviewQuery() {
  return useQuery({
    queryKey: ['admin', 'cluster-overview'],
    queryFn: adminApi.getClusterOverview,
    refetchInterval: 15_000,
  });
}

export function useDeploymentsQuery(search: string, page: number) {
  return useQuery({
    queryKey: ['admin', 'deployments', search, page],
    queryFn: () => adminApi.listDeployments(search, page),
    placeholderData: (prev) => prev,
  });
}

export function useRestartDeploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deploymentId: string) => adminApi.restartDeployment(deploymentId),
    onSuccess: () => {
      toast.success('Restart queued', 'Service restart');
      queryClient.invalidateQueries({ queryKey: ['admin', 'deployments'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to restart service'), 'Error'),
  });
}

export function useForceStopDeploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deploymentId, reason }: { deploymentId: string; reason?: string }) =>
      adminApi.forceStopDeployment(deploymentId, reason),
    onSuccess: () => {
      toast.success('Container force-stopped', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'deployments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cluster-overview'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to force-stop container'), 'Error'),
  });
}

export function usePurgeDeploymentCacheMutation() {
  return useMutation({
    mutationFn: (deploymentId: string) => adminApi.purgeDeploymentCache(deploymentId),
    onSuccess: () => toast.success('Build image purged; next deploy rebuilds from scratch', 'Cache purged'),
    onError: (err) => toast.error(errorMessage(err, 'Failed to purge cache'), 'Error'),
  });
}

export function useDeploymentEnvQuery(deploymentId: string | null) {
  return useQuery({
    queryKey: ['admin', 'deployment-env', deploymentId],
    queryFn: () => adminApi.getDeploymentEnv(deploymentId as string),
    enabled: !!deploymentId,
  });
}

// ---------------------------------------------------------------------------
// Module C: Billing, Quotas & Abuse
// ---------------------------------------------------------------------------

export function useUpdateQuotaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: adminApi.QuotaPatch }) =>
      adminApi.updateQuota(userId, patch),
    onSuccess: (_data, vars) => {
      toast.success('Quota updated', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'quota-history', vars.userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to update quota'), 'Error'),
  });
}

export function useRestoreQuotaDefaultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.restoreQuotaDefaults(userId),
    onSuccess: (_data, userId) => {
      toast.success('Quota restored to plan defaults', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'quota-history', userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to restore defaults'), 'Error'),
  });
}

export function useResetQuotaUsageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.resetQuotaUsage(userId),
    onSuccess: (_data, userId) => {
      toast.success('Usage counters reset', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to reset usage'), 'Error'),
  });
}

export function useQuotaHistoryQuery(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'quota-history', userId],
    queryFn: () => adminApi.getQuotaHistory(userId as string),
    enabled: !!userId,
  });
}

export function useCreditBalanceQuery(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'credits', userId],
    queryFn: () => adminApi.getCreditBalance(userId as string),
    enabled: !!userId,
  });
}

export function useIssueCreditMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amountCents, reason }: { userId: string; amountCents: number; reason: string }) =>
      adminApi.issueCredit(userId, amountCents, reason),
    onSuccess: (_data, vars) => {
      toast.success('Credit issued', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'credits', vars.userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to issue credit'), 'Error'),
  });
}

export function useRevokeCreditMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amountCents, reason }: { userId: string; amountCents: number; reason: string }) =>
      adminApi.revokeCredit(userId, amountCents, reason),
    onSuccess: (_data, vars) => {
      toast.success('Credit revoked', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'credits', vars.userId] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to revoke credit'), 'Error'),
  });
}

export function useRiskAlertsQuery(status?: string) {
  return useQuery({
    queryKey: ['admin', 'risk-alerts', status ?? 'all'],
    queryFn: () => adminApi.listRiskAlerts(status),
    refetchInterval: 30_000,
  });
}

export function useIsolateRiskAlertMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, deploymentId }: { alertId: string; deploymentId?: string }) =>
      adminApi.isolateRiskAlert(alertId, deploymentId),
    onSuccess: () => {
      toast.success('Service isolated and alert resolved', 'Done');
      queryClient.invalidateQueries({ queryKey: ['admin', 'risk-alerts'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to isolate service'), 'Error'),
  });
}

// ---------------------------------------------------------------------------
// Module D: Audit logs
// ---------------------------------------------------------------------------

export function useAuditLogsQuery(filters: adminApi.AuditLogFilters) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => adminApi.listAuditLogs(filters),
    placeholderData: (prev) => prev,
  });
}
