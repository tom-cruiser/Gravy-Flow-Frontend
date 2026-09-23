import { api } from '@/lib/api';

// Contracts for the Go control plane's GitHub App integration
// (cmd/api/github_integration.go).

export type GitHubInstallation = {
  id: string;
  githubInstallationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization' | string;
  repositorySelection: 'all' | 'selected' | string;
  repositories: { id: number; fullName: string; private: boolean }[];
  suspendedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubInstallationsResponse = {
  configured: boolean;
  installations: GitHubInstallation[];
};

export type GitHubRepo = {
  id: number;
  installationId: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  pushedAt?: string;
};

export type GitHubReposResponse = {
  repositories: GitHubRepo[];
  warnings?: string[];
};

export async function fetchGitHubInstallations(): Promise<GitHubInstallationsResponse> {
  const response = await api.get<GitHubInstallationsResponse>('/integrations/github/installations');
  return response.data;
}

export async function fetchGitHubRepos(): Promise<GitHubReposResponse> {
  const response = await api.get<GitHubReposResponse>('/integrations/github/repos');
  return response.data;
}

// Sends the browser to GitHub to install the app, or to change which
// repositories an existing installation can see. GitHub redirects back to the
// dashboard with ?github=<result> (see readGitHubSetupResult).
export async function startGitHubSetup(): Promise<void> {
  const response = await api.get<{ url: string }>('/integrations/github/setup');
  window.location.assign(response.data.url);
}

const SETUP_ERRORS: Record<string, string> = {
  not_configured: 'The GitHub integration is not configured on this server.',
  invalid_state: 'The GitHub connection link expired or was not started from this dashboard. Try again.',
  missing_installation: 'GitHub did not report an installation. Try connecting again.',
  missing_oauth_code: 'GitHub did not confirm your identity. Ask an administrator to check the GitHub App settings.',
  oauth_failed: 'GitHub could not confirm your identity. Try connecting again.',
  installation_not_accessible: 'Your GitHub account cannot access that installation.',
  github_unavailable: 'GitHub could not be reached. Try again in a moment.',
  save_failed: 'The GitHub installation could not be saved. Try again.',
};

export type GitHubSetupResult = { variant: 'success' | 'info' | 'error'; message: string };

// Reads and strips the ?github= result the setup callback appends.
export function readGitHubSetupResult(): GitHubSetupResult | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const result = url.searchParams.get('github');
  if (!result) return null;

  url.searchParams.delete('github');
  window.history.replaceState(window.history.state, '', url.toString());

  if (result === 'connected') return { variant: 'success', message: 'GitHub connected. Your repositories are ready to deploy.' };
  if (result === 'requested') {
    return { variant: 'info', message: 'Installation requested. An organization owner has to approve it on GitHub.' };
  }
  const reason = result.startsWith('error:') ? result.slice('error:'.length) : result;
  return { variant: 'error', message: SETUP_ERRORS[reason] ?? 'Connecting GitHub failed.' };
}
