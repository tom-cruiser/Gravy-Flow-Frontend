// Shared deployment-status → display mapping, used by both the admin
// Overview page's status tiles and the Infrastructure page's table so the
// two views can't drift out of sync on what each status means visually.

export type DeploymentStatusVariant = 'success' | 'warning' | 'destructive' | 'default';

const VARIANT_BY_STATUS: Record<string, DeploymentStatusVariant> = {
  running: 'success',
  building: 'warning',
  deploying: 'warning',
  stopped: 'default',
  failed: 'destructive',
};

export function deploymentStatusVariant(status: string): DeploymentStatusVariant {
  return VARIANT_BY_STATUS[status.toLowerCase()] ?? 'default';
}

export function deploymentStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Buckets used by the Overview page's "Service status" tiles — coarser than
// the raw status column so building/deploying (both "in progress") and
// stopped/failed (both "not running") each read as one number.
export type DeploymentStatusBucket = 'running' | 'inProgress' | 'notRunning';

const BUCKET_BY_STATUS: Record<string, DeploymentStatusBucket> = {
  running: 'running',
  building: 'inProgress',
  deploying: 'inProgress',
  stopped: 'notRunning',
  failed: 'notRunning',
};

export function deploymentStatusBucket(status: string): DeploymentStatusBucket {
  return BUCKET_BY_STATUS[status.toLowerCase()] ?? 'notRunning';
}
