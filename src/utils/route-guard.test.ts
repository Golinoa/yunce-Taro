import { describe, expect, it } from 'vitest';
import { getProfileRoles, requireRole } from '@/utils/route-guard';
import type { Profile, UserRole } from '@/types/profile';

function profileWithRoles(roles: UserRole[], current?: UserRole): Profile {
  return {
    identities: roles.map((role, i) => ({
      id: `id-${i}`,
      role,
      campusId: 'c1',
      campusName: '校区',
    })),
    currentContext: current
      ? { role: current, campusId: 'c1', campusName: '校区' }
      : undefined,
  } as Profile;
}

describe('route-guard role helpers (Q3-5)', () => {
  it('getProfileRoles merges identities and currentContext', () => {
    expect(getProfileRoles(null)).toEqual([]);
    expect(getProfileRoles(profileWithRoles(['teacher'], 'admin')).sort()).toEqual(
      ['admin', 'teacher'].sort(),
    );
  });

  it('requireRole allows empty allowed; otherwise any matching role', () => {
    const profile = profileWithRoles(['teacher']);
    expect(requireRole(undefined, profile)).toBe(true);
    expect(requireRole([], profile)).toBe(true);
    expect(requireRole(['admin', 'principal'], profile)).toBe(false);
    expect(requireRole(['teacher', 'admin'], profile)).toBe(true);
  });
});
