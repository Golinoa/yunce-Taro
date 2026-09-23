import { describe, expect, it } from 'vitest';
import { resolveStudentQueryGate } from './students-query-gate';

describe('students query auth-restore regression', () => {
  it('keeps the list query enabled while profile is restoring from auth/me', () => {
    const result = resolveStudentQueryGate({
      profileId: null,
      sessionUserId: 'profile-demo-teacher',
      role: null,
    });

    // This is the state represented by the historical 939f4258 fix:
    // session exists, /auth/me profile has not been applied yet.
    expect(result).toEqual({ actorId: 'profile-demo-teacher', enabled: true });
  });

  it('prefers the restored profile id after auth/me completes', () => {
    expect(
      resolveStudentQueryGate({
        profileId: 'profile-from-me',
        sessionUserId: 'profile-from-session',
        role: 'principal',
      }),
    ).toEqual({ actorId: 'profile-from-me', enabled: true });
  });
});
