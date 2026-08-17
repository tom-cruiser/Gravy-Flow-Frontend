'use client';

import { useState } from 'react';
import { MoreHorizontal, Search, ShieldAlert, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteUserMutation, useImpersonateUserMutation, useSetUserStatusMutation, useUsersQuery } from '@/lib/adminQueries';
import type { AdminUserSummary, DeleteMode, UserStatus } from '@/lib/adminApi';
import { UserDetailDialog } from './UserDetailDialog';
import { toast } from '@/store/toastStore';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  active: 'success',
  suspended: 'warning',
  flagged: 'warning',
  deleted: 'destructive',
};

const STATUSES: UserStatus[] = ['active', 'suspended', 'flagged', 'deleted'];

export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ email: '', userId: '', workspace: '', githubHandle: '' });
  const [page, setPage] = useState(1);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('soft');
  const [deleteReason, setDeleteReason] = useState('');

  const usersQuery = useUsersQuery({ ...filters, page, perPage: 25 });
  const setStatus = useSetUserStatusMutation();
  const deleteUser = useDeleteUserMutation();
  const impersonate = useImpersonateUserMutation();

  // issueImpersonationToken (auth.go) returns a normal-looking access token
  // that's tagged so ImpersonationReadOnlyMiddleware blocks every mutating
  // request made with it — but this frontend's session store is a single
  // shared localStorage slot (see store/authStore.ts), so swapping it into
  // the admin's own tab would clobber their real session. Copying it out for
  // use in a separate tool (curl/Postman) against the API, rather than
  // simulating a second browser session, is the safe integration point until
  // this app grows real multi-session support.
  const runImpersonate = (user: AdminUserSummary) => {
    impersonate.mutate(
      { userId: user.id, reason: 'admin inspection' },
      {
        onSuccess: async (data) => {
          try {
            await navigator.clipboard.writeText(data.accessToken);
            toast.success(`Read-only token for ${user.email} copied to clipboard (expires in ${Math.round(data.expiresIn / 60)}m)`, 'Impersonation issued');
          } catch {
            toast.success(`Read-only token for ${user.email} issued (expires in ${Math.round(data.expiresIn / 60)}m)`, 'Impersonation issued');
          }
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">Search, manage account status, and inspect individual accounts.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Email"
            value={filters.email}
            onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="User ID"
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
        />
        <Input
          placeholder="Workspace name"
          value={filters.workspace}
          onChange={(e) => setFilters((f) => ({ ...f, workspace: e.target.value }))}
        />
        <Input
          placeholder="GitHub handle"
          value={filters.githubHandle}
          onChange={(e) => setFilters((f) => ({ ...f, githubHandle: e.target.value }))}
        />
      </form>

      {usersQuery.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="gf-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deployments</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <button className="text-left hover:underline" onClick={() => setDetailUserId(user.id)}>
                      <div className="font-medium text-zinc-100">{user.displayName}</div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[user.status] ?? 'default'}>{user.status}</Badge>
                    {user.isAdmin && (
                      <Badge variant="accent" className="ml-1.5">
                        admin
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{user.deploymentCount}</TableCell>
                  <TableCell className="text-zinc-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'never'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {STATUSES.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            disabled={status === user.status}
                            onClick={() => setStatus.mutate({ userId: user.id, status })}
                          >
                            {status}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => runImpersonate(user)}>
                          <ShieldAlert className="mr-2 h-4 w-4" /> Impersonate (read-only)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-rose-300 focus:bg-rose-500/10"
                          onClick={() => {
                            setDeleteTarget(user);
                            setDeleteMode('soft');
                            setDeleteReason('');
                          }}
                        >
                          <UserX className="mr-2 h-4 w-4" /> Delete…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {usersQuery.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                    No users match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {usersQuery.data && usersQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-brand-700/50 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {usersQuery.data.page} of {usersQuery.data.totalPages} ({usersQuery.data.totalCount} users)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= usersQuery.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <UserDetailDialog userId={detailUserId} onClose={() => setDetailUserId(null)} />

      {/* Two-step deletion workflow (Module A): soft retains data for 30 days
          and revokes access; hard purges DB records, containers, and (per
          AdminHardDeleteUser) storage volumes. */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.email}</DialogTitle>
            <DialogDescription>Choose how this account should be removed.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-gf border border-brand-700/50 bg-brand-800/40 p-3">
              <input
                type="radio"
                name="deleteMode"
                checked={deleteMode === 'soft'}
                onChange={() => setDeleteMode('soft')}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-100">Soft delete</span>
                <span className="block text-xs text-zinc-500">
                  Revokes access immediately; data is retained for 30 days.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-gf border border-rose-500/30 bg-rose-500/5 p-3">
              <input
                type="radio"
                name="deleteMode"
                checked={deleteMode === 'hard'}
                onChange={() => setDeleteMode('hard')}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-rose-300">Hard delete</span>
                <span className="block text-xs text-zinc-500">
                  Permanently purges database records, containers, and storage volumes. Cannot be undone.
                </span>
              </span>
            </label>
            <Input
              placeholder="Reason (recorded in the audit log)"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteUser.mutate(
                  { userId: deleteTarget.id, mode: deleteMode, reason: deleteReason },
                  { onSuccess: () => setDeleteTarget(null) },
                );
              }}
            >
              {deleteMode === 'hard' ? 'Permanently delete' : 'Soft delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
