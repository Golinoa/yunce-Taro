import { describe, expect, it } from 'vitest';
import type { Profile, UserRole } from '@/types/profile';
import { getProfileRoles, requireRole } from '@/utils/route-guard';

function profileWithRoles(roles: UserRole[], current?: UserRole): Profile {
  return {
    identities: roles.map((role, i) => ({
      id: `id-${i}`,
      role,
      organizationId: 'org-1',
      organizationName: '机构',
      isDefault: i === 0,
    })),
    currentContext: current
      ? {
          identityId: 'id-0',
          role: current,
          organizationId: 'org-1',
          campusId: 'c1',
        }
      : ({
          identityId: 'id-0',
          role: roles[0],
          organizationId: 'org-1',
          campusId: 'c1',
        } as Profile['currentContext']),
    id: 'p1',
    name: '测试',
    created_at: '',
    updated_at: '',
  };
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
