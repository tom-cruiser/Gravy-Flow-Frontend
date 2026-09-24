// Per-service monorepo build settings (GravyFlow-Backend-'s
// cmd/api/build_settings.go). Same shared axios instance as the rest of lib/.
import { api } from './api';

export type BuildSettings = {
  // Dockerfile to build, relative to the repository root (which stays the
  // build context). Empty = auto-detect the project at the root.
  dockerfilePath: string;
  // Port the app listens on. 0 = read the Dockerfile's EXPOSE, else 8080.
  containerPort: number;
};

export function getBuildSettings(deploymentId: string) {
  return api.get<{ buildSettings: BuildSettings }>(`/apps/${deploymentId}/build-settings`).then((r) => r.data.buildSettings);
}

export function updateBuildSettings(deploymentId: string, settings: BuildSettings) {
  return api
    .put<{ buildSettings: BuildSettings }>(`/apps/${deploymentId}/build-settings`, settings)
    .then((r) => r.data.buildSettings);
}
