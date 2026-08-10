// Backend portMap strings follow the Docker convention `hostPort:containerPort`
// (see cmd/api/docker.go parsePortMap). Callers on the frontend care about the
// internal/container port the app actually listens on, which is the second
// segment. A bare single-port string (no colon) means host and container
// ports are identical, matching the backend's own fallback behavior.
export function parseContainerPort(portMap: string | undefined | null, fallback = 8080): number {
  if (!portMap) return fallback;

  const [hostPort, containerPort] = String(portMap).split(':');
  const raw = containerPort ?? hostPort;
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
