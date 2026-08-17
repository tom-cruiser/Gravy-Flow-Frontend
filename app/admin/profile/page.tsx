import { PasswordForm } from './password-form';
import { MFAManagement } from './mfa-management';

// Admin Profile & Credentials Management (Module E). Everything on this page
// acts on the signed-in admin/SRE's OWN account — distinct from
// /admin/users/[id], which acts on someone else's.
export default function AdminProfilePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Profile & security</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your own password and multi-factor authentication.</p>
      </div>
      <PasswordForm />
      <MFAManagement />
    </div>
  );
}
