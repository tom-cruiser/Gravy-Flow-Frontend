'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PasswordForm } from '@/components/settings/PasswordForm';
import { PlanPicker } from '@/components/settings/PlanPicker';

// Account settings for ANY signed-in user (not the admin panel — that's
// /admin/profile, which renders the same PasswordForm plus admin-only MFA
// management). Regular users don't have MFA enrollment available to them
// (mfaEnrollHandler in admin_mfa.go restricts it to admins), so there's no
// MFA section here — just the two things every account actually needs:
// credentials and their subscription plan.
export default function DashboardSettingsPage() {
  return (
    <main className="min-h-screen bg-brand-950 px-4 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Account settings</h1>
            <p className="mt-1 text-sm text-zinc-500">Manage your password and subscription plan.</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-gf border border-brand-700/60 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-brand-500 hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </div>
        <PasswordForm />
        <PlanPicker />
      </div>
    </main>
  );
}
