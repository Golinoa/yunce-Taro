import { describe, expect, it } from 'vitest';
import { buildPointToPointInvitePayload } from './campus-invite';

describe('campus-invite point-to-point payload', () => {
  it('携带 targetTeacherId 与校区/角色', () => {
    expect(
      buildPointToPointInvitePayload({
        campusId: '11111111-1111-1111-1111-111111111111',
        teacherId: '22222222-2222-2222-2222-222222222222',
      }),
    ).toEqual({
      campusId: '11111111-1111-1111-1111-111111111111',
      targetTeacherId: '22222222-2222-2222-2222-222222222222',
      roleCode: 'campus_teacher',
      expireMinutes: 24 * 60,
    });
  });
});
