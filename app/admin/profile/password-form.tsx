'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertCircle, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { changePassword, type PasswordChangeError } from '@/lib/adminApi';
import { evaluatePasswordRules, passwordMeetsAllRules, SERVER_VIOLATION_MESSAGES } from '@/lib/passwordRules';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(1, 'Enter a new password'),
    confirmNewPassword: z.string().min(1, 'Confirm your new password'),
    logoutOtherDevices: z.boolean(),
  })
  .refine((data) => passwordMeetsAllRules(data.newPassword), {
    message: 'Password does not meet the requirements below',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

function PasswordVisibilityToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
      aria-label={visible ? 'Hide password' : 'Show password'}
      tabIndex={-1}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

// Admin Profile & Credentials Management (Module E) — self-service password
// rotation for the signed-in admin/SRE's own account. Talks to
// GravyFlow-Backend-'s POST /admin/profile/password (cmd/api/admin_profile.go),
// which verifies currentPassword server-side, re-validates strength, hashes
// with bcrypt, optionally revokes every other session's refresh token, and
// records an audit log entry either way.
export function PasswordForm() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
      logoutOtherDevices: false,
    },
  });

  const newPassword = watch('newPassword');
  const rules = evaluatePasswordRules(newPassword, user?.email);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await changePassword(values.currentPassword, values.newPassword, values.logoutOtherDevices);

      // The backend only returns fresh tokens when logoutOtherDevices was
      // true (it just revoked every refresh token including this session's,
      // then re-issued a pair so this tab isn't logged out by its own
      // request) — see AdminChangePasswordResponse in admin_profile.go.
      if (result.sessionsRevoked && result.accessToken && result.refreshToken && user) {
        setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, user });
        toast.success('Password updated. All other sessions have been signed out.', 'Password changed');
      } else {
        toast.success('Password updated.', 'Password changed');
      }

      reset();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: PasswordChangeError } };
      const data = axiosErr?.response?.data;

      if (data?.error === 'invalid_current_password') {
        setError('currentPassword', { message: 'Incorrect current password' });
      } else if (data?.error === 'password_reuse') {
        setError('newPassword', { message: 'New password must be different from your current password' });
      } else if (data?.error === 'weak_password' && data.violations?.length) {
        const messages = data.violations.map((v) => SERVER_VIOLATION_MESSAGES[v] ?? v);
        setError('newPassword', { message: messages.join(' · ') });
      } else {
        setFormError('Failed to update password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Credentials</CardDescription>
          <CardTitle>Change password</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {formError && (
            <div className="flex items-start gap-2.5 rounded-gf border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-10"
                {...register('currentPassword')}
              />
              <PasswordVisibilityToggle visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            </div>
            {errors.currentPassword && <p className="text-xs text-rose-400">{errors.currentPassword.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                {...register('newPassword')}
              />
              <PasswordVisibilityToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} />
            </div>

            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    rule.passed ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {rule.passed ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                  {rule.label}
                </li>
              ))}
            </ul>

            {errors.newPassword && <p className="text-xs text-rose-400">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmNewPassword">Confirm new password</Label>
            <Input
              id="confirmNewPassword"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmNewPassword')}
            />
            {errors.confirmNewPassword && <p className="text-xs text-rose-400">{errors.confirmNewPassword.message}</p>}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-gf border border-brand-700/50 bg-brand-800/40 p-3.5">
            <div>
              <p className="text-sm font-medium text-zinc-100">Log out from all other devices</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Revokes every other session immediately. This one stays signed in.
              </p>
            </div>
            <Controller
              name="logoutOtherDevices"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Log out from all other devices" />
              )}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
