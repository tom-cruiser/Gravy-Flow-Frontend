// Client-side mirror of the violation codes returned by the backend's
// validatePasswordStrength (GravyFlow-Backend-'s cmd/api/admin_profile.go).
// This is a UX layer only, for the live checklist in password-form.tsx — the
// backend re-validates every rule on submit and is the real security
// boundary. Keep these two in sync if the rules ever change.
export const MIN_PASSWORD_LENGTH = 12;

export type PasswordRuleResult = {
  id: string;
  label: string;
  passed: boolean;
};

export function evaluatePasswordRules(password: string, email?: string): PasswordRuleResult[] {
  const unique = new Set(password);
  const localPart = email?.split('@')[0]?.toLowerCase() ?? '';

  return [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      passed: password.length >= MIN_PASSWORD_LENGTH,
    },
    { id: 'uppercase', label: 'One uppercase letter', passed: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter', passed: /[a-z]/.test(password) },
    { id: 'digit', label: 'One number', passed: /[0-9]/.test(password) },
    { id: 'specialChar', label: 'One special character', passed: /[^A-Za-z0-9]/.test(password) },
    // Crude entropy floor, not real entropy estimation — matches the
    // backend's "fewer than 6 distinct characters" heuristic.
    { id: 'entropy', label: 'Not mostly repeated characters', passed: unique.size >= 6 },
    {
      id: 'notEmail',
      label: 'Does not contain your email address',
      passed: localPart.length < 4 || !password.toLowerCase().includes(localPart),
    },
  ];
}

export function passwordMeetsAllRules(password: string, email?: string): boolean {
  return password.length > 0 && evaluatePasswordRules(password, email).every((rule) => rule.passed);
}

// Maps backend violation codes (a weak_password response's `violations`
// array) to human copy, so a server-side-only rejection — e.g. the
// common-password denylist, which has no client-side equivalent — still
// surfaces as a specific message instead of a generic "weak password" toast.
export const SERVER_VIOLATION_MESSAGES: Record<string, string> = {
  min_length: `Must be at least ${MIN_PASSWORD_LENGTH} characters`,
  uppercase: 'Must include an uppercase letter',
  lowercase: 'Must include a lowercase letter',
  digit: 'Must include a number',
  special_char: 'Must include a special character',
  low_entropy: 'Password is too repetitive',
  contains_email: 'Password cannot contain your email address',
  common_password: 'This password is too common — choose another',
};
