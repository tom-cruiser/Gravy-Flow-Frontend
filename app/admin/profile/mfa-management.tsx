'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, ShieldOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { disableMFA, regenerateRecoveryCodes } from '@/lib/adminApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

// Disable / regenerate-recovery-codes half of Module E's MFA management.
// Enrollment (secret + QR + confirm-with-TOTP) already lives at
// /admin/mfa-setup — this component only covers what happens once MFA is
// already on, and hits the two admin_mfa-adjacent routes added in
// GravyFlow-Backend-'s cmd/api/admin_profile.go.
export function MFAManagement() {
  const mfaEnabled = useAuthStore((s) => s.user?.mfaEnabled);
  const patchUser = useAuthStore((s) => s.patchUser);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const [codes, setCodes] = useState<string[] | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const submitDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError(null);
    setDisabling(true);
    try {
      await disableMFA(disablePassword);
      patchUser({ mfaEnabled: false });
      setDisableOpen(false);
      setDisablePassword('');
      toast.success('MFA has been disabled on this account.', 'MFA disabled');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setDisableError(
        axiosErr?.response?.data?.error === 'invalid_current_password' ? 'Incorrect password' : 'Failed to disable MFA.',
      );
    } finally {
      setDisabling(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateRecoveryCodes();
      setCodes(result.codes);
    } catch {
      toast.error('Failed to generate recovery codes.', 'Try again');
    } finally {
      setRegenerating(false);
    }
  };

  const copyCodes = () => {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join('\n')).then(() => toast.success('Recovery codes copied.'));
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Multi-factor authentication</CardDescription>
          <CardTitle>Two-factor authentication</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mfaEnabled ? (
          <div className="flex items-center justify-between gap-3 rounded-gf border border-amber-500/25 bg-amber-500/10 p-3.5">
            <p className="text-sm text-amber-200">MFA is not enabled on this account.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/mfa-setup">Enable MFA</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-gf border border-emerald-500/25 bg-emerald-500/10 p-3.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-200">MFA is enabled on this account.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                <KeyRound className="h-3.5 w-3.5" />
                {regenerating ? 'Generating…' : 'Regenerate recovery codes'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                <ShieldOff className="h-3.5 w-3.5" />
                Disable MFA
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Disable-MFA confirmation: requires the current password, same as the
          backend's adminMFADisableHandler — a valid session alone isn't
          enough to turn off an account's own second factor. */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication</DialogTitle>
            <DialogDescription>Confirm your password to turn off MFA on this account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDisable} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="disable-mfa-password">Current password</Label>
              <Input
                id="disable-mfa-password"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
                required
              />
              {disableError && <p className="text-xs text-rose-400">{disableError}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={disabling || !disablePassword}>
                {disabling ? 'Disabling…' : 'Disable MFA'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recovery codes are returned exactly once by the backend (only their
          hashes are persisted), so this dialog is the only chance to save
          them. */}
      <Dialog open={codes !== null} onOpenChange={(open) => !open && setCodes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new recovery codes</DialogTitle>
            <DialogDescription>
              Save these somewhere safe. Each code works once, and this is the only time they&apos;ll be shown. Any
              previous codes have been invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-gf border border-brand-700/50 bg-brand-800/60 p-4 font-mono text-sm text-zinc-100">
            {codes?.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyCodes}>
              <Copy className="h-3.5 w-3.5" />
              Copy all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
