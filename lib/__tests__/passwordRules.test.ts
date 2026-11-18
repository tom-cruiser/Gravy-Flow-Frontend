import { describe, expect, it } from 'vitest';
import { evaluatePasswordRules, passwordMeetsAllRules } from '@/lib/passwordRules';

const failed = (password: string, email?: string) =>
  evaluatePasswordRules(password, email).filter((r) => !r.passed).map((r) => r.id);

describe('password rules', () => {
  it('accepts a strong password', () => {
    expect(passwordMeetsAllRules('Correct-Horse-9')).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(passwordMeetsAllRules('')).toBe(false);
  });

  it('reports each missing rule', () => {
    expect(failed('short')).toEqual(['length', 'uppercase', 'digit', 'specialChar', 'entropy']);
    expect(failed('Aaaaaaaaaaa1!')).toEqual(['entropy']);
  });

  it('rejects passwords containing the email local part', () => {
    expect(failed('Xjohnsmith-42', 'johnsmith@example.com')).toEqual(['notEmail']);
    // Local parts shorter than 4 chars are ignored.
    expect(failed('Xbob-strong-42', 'bob@example.com')).toEqual([]);
  });
});
