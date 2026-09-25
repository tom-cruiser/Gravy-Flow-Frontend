'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mfaEnable, mfaEnroll } from '@/lib/adminApi';
import { useAuthStore } from '@/store/authStore';

// MFA is required for admin access (AdminMiddleware in auth.go), so AdminRoute
// sends every un-enrolled admin here before any other admin page loads.
export default function AdminMfaSetupPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [secret, setSecret] = useState<string | null>(null);
  const [provisioningUri, setProvisioningUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each enroll call rotates the pending secret server-side. React StrictMode
  // runs this effect twice in dev, and two calls let the QR shown come from
  // a secret the second call already replaced — every code then fails. The
  // ref survives StrictMode's simulated remount, so enroll runs once.
  const enrollStarted = useRef(false);

  useEffect(() => {
    if (user?.mfaEnabled || enrollStarted.current) return;
    enrollStarted.current = true;
    mfaEnroll()
      .then((data) => {
        setSecret(data.secret);
        setProvisioningUri(data.provisioningUri);
      })
      .catch(() => setError('Failed to start MFA enrollment.'));
    // Only run once per mount — re-enrolling on every render would rotate the
    // pending secret and invalidate whatever the admin just scanned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setLoading(true);
    try {
      // Enabling revokes every older session and returns an MFA-verified one.
      const session = await mfaEnable(code);
      setSession({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user });
      router.push('/admin/profile');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error === 'invalid_mfa_code' ? 'Incorrect code — try again.' : 'Failed to enable MFA.');
    } finally {
      setLoading(false);
    }
  };

  if (user?.mfaEnabled) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Two-factor authentication</h1>
          <p className="mt-1 text-sm text-zinc-500">Optional — you can enable or skip this per admin account.</p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">MFA is enabled on this account</p>
              <p className="text-xs text-zinc-500">
                Every future login will ask for a code from your authenticator app.
              </p>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => router.push('/admin')}>
          Back to admin panel
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Enable two-factor authentication</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Optional. Scan the QR code (or enter the secret manually) in your authenticator app, then confirm with a
          live code — once enabled, every future login will require it.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-gf border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Step 1</CardDescription>
            <CardTitle>Enroll</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {secret ? (
            <>
              <p className="text-sm text-zinc-400">Manual entry secret:</p>
              <code className="block break-all rounded-gf border border-brand-700/50 bg-brand-800/60 p-3 text-sm text-brand-200">
                {secret}
              </code>
              {provisioningUri && (
                <a href={provisioningUri} className="gf-link block text-xs">
                  Open in authenticator app
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500">Generating secret…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Step 2</CardDescription>
            <CardTitle>Confirm</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="gf-input text-center text-lg tracking-[0.5em]"
              placeholder="000000"
              required
            />
            <Button type="submit" className="w-full" disabled={loading || !secret}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {loading ? 'Enabling…' : 'Enable MFA'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
