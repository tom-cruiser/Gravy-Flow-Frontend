'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthShell } from '@/components/auth/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || undefined;

    setLoading(true);
    try {
      const resp = await api.post('/auth/register', { email, password, displayName });
      const data = resp.data;
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const message = axiosErr?.response?.data?.error || axiosErr?.message || 'Registration failed';
      setError(String(message).replace(/_/g, ' '));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 md:hidden">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Gravy<span className="text-brand-300">Flow</span>
        </Link>
      </div>

      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Create an account</h1>
        <p className="text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="gf-link">
            Log in
          </Link>
        </p>
      </div>

      {error ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-gf border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="gf-input"
            placeholder="First name"
          />
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="gf-input"
            placeholder="Last name"
          />
        </div>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="gf-input"
          placeholder="Email"
          required
        />

        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="gf-input pr-11"
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="gf-checkbox mt-0.5"
          />
          <span>
            I agree to the{' '}
            <span className="gf-link cursor-pointer">Terms &amp; Conditions</span>
          </span>
        </label>

        <button type="submit" disabled={loading} className="gf-btn-primary">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="gf-divider my-6 px-2">
        <span className="relative z-10 bg-brand-900 px-3">Or register with</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled className="gf-btn-outline opacity-50" title="Coming soon">
          <GoogleIcon />
          Google
        </button>
        <button type="button" disabled className="gf-btn-outline opacity-50" title="Coming soon">
          <AppleIcon />
          Apple
        </button>
      </div>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
