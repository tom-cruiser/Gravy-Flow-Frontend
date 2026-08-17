'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuditLogsQuery } from '@/lib/adminQueries';
import type { AuditLogEntry } from '@/lib/adminApi';

function toCsv(rows: AuditLogEntry[]) {
  const header = ['timestamp', 'actorEmail', 'action', 'targetType', 'targetId', 'ipAddress'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.createdAt, r.actorEmail, r.action, r.targetType, r.targetId, r.ipAddress].map((v) => escape(String(v ?? ''))).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

// Client-side export from whatever page is currently loaded — the spec asks
// for CSV export and there's no dedicated backend export endpoint, so this
// covers the visible page rather than the full unbounded result set.
function downloadCsv(rows: AuditLogEntry[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({ actorEmail: '', targetType: '', targetId: '', action: '' });
  const [page, setPage] = useState(1);
  const auditLogs = useAuditLogsQuery({ ...filters, page, perPage: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Audit log</h1>
          <p className="mt-1 text-sm text-zinc-500">Immutable — every admin action recorded here cannot be edited or deleted.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!auditLogs.data?.items.length}
          onClick={() => auditLogs.data && downloadCsv(auditLogs.data.items)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export page as CSV
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          placeholder="Actor email"
          value={filters.actorEmail}
          onChange={(e) => setFilters((f) => ({ ...f, actorEmail: e.target.value }))}
        />
        <Input
          placeholder="Action (e.g. user.delete.hard)"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
        />
        <Input
          placeholder="Target type (user, deployment)"
          value={filters.targetType}
          onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
        />
        <Input
          placeholder="Target ID"
          value={filters.targetId}
          onChange={(e) => setFilters((f) => ({ ...f, targetId: e.target.value }))}
        />
      </form>

      {auditLogs.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="gf-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.data?.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-zinc-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-zinc-200">{entry.actorEmail}</TableCell>
                  <TableCell className="font-mono text-xs text-brand-300">{entry.action}</TableCell>
                  <TableCell className="text-zinc-400">
                    {entry.targetType}
                    {entry.targetId ? `:${entry.targetId.slice(0, 8)}` : ''}
                  </TableCell>
                  <TableCell className="text-zinc-500">{entry.ipAddress}</TableCell>
                </TableRow>
              ))}
              {auditLogs.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                    No matching audit entries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {auditLogs.data && auditLogs.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-brand-700/50 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {auditLogs.data.page} of {auditLogs.data.totalPages} ({auditLogs.data.totalCount} entries)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= auditLogs.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
