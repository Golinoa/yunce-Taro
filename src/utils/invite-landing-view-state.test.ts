import { describe, expect, it } from 'vitest';
import {
  resolveCampusInviteLandingView,
  resolveParentShareLandingView,
} from './invite-landing-view-state';

describe('invite-landing-view-state (V2T/V3T FE 分态)', () => {
  describe('L2 V2T-4 / V2T-5 / V2T-6', () => {
    it('V2T-6: expired → 过期页', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'expired', usedByUserId: null }, null),
      ).toBe('expired');
    });

    it('V2T-4: used + 绑定者 → 成功页', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'used', usedByUserId: 'user-a' }, 'user-a'),
      ).toBe('success_for_viewer');
    });

    it('V2T-5: used + 非绑定者 → 失效页', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'used', usedByUserId: 'user-a' }, 'user-b'),
      ).toBe('used_invalid');
      expect(
        resolveParentShareLandingView({ inviteStatus: 'used', usedByUserId: 'user-a' }, null),
      ).toBe('used_invalid');
    });

    it('V2T-2: pending → 注册页', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'pending', usedByUserId: null }, null),
      ).toBe('pending');
    });

    it('非法/未知 inviteStatus → 按 pending 可注册态（页内再校验 token）', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'invalid', usedByUserId: null }, null),
      ).toBe('pending');
      expect(
        resolveParentShareLandingView({ inviteStatus: '', usedByUserId: null }, 'user-x'),
      ).toBe('pending');
    });

    it('已绑定但 viewer 角色/身份不匹配（usedBy 非当前用户）→ used_invalid', () => {
      expect(
        resolveParentShareLandingView({ inviteStatus: 'used', usedByUserId: 'binder' }, 'other'),
      ).toBe('used_invalid');
    });
  });

  describe('L3 V3T-3 / V3T-4', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 3600_000).toISOString();

    it('V3T-3: USED + 接受者 → 成功页', () => {
      expect(
        resolveCampusInviteLandingView(
          { status: 'USED', expireAt: future, usedByUserId: 'staff-1' },
          'staff-1',
        ),
      ).toBe('success_for_viewer');
    });

    it('V3T-2 FE: USED + 他人 → 失效', () => {
      expect(
        resolveCampusInviteLandingView(
          { status: 'USED', expireAt: future, usedByUserId: 'staff-1' },
          'staff-2',
        ),
      ).toBe('used_invalid');
    });

    it('USED 但 usedByUserId 缺失 / 未登录 → used_invalid（非本人绑定）', () => {
      expect(
        resolveCampusInviteLandingView(
          { status: 'USED', expireAt: future, usedByUserId: null },
          null,
        ),
      ).toBe('used_invalid');
      expect(
        resolveCampusInviteLandingView(
          { status: 'USED', expireAt: future, usedByUserId: undefined },
          'staff-1',
        ),
      ).toBe('used_invalid');
    });

    it('V3T-4: 过期 → 不可接受态', () => {
      expect(resolveCampusInviteLandingView({ status: 'PENDING', expireAt: past }, 'staff-1')).toBe(
        'expired',
      );
      expect(resolveCampusInviteLandingView({ status: 'EXPIRED', expireAt: future }, null)).toBe(
        'expired',
      );
    });

    it('expireAt 恰等于 now → expired；PENDING 未过期 → pending', () => {
      const now = Date.parse('2026-09-03T00:00:00.000Z');
      expect(
        resolveCampusInviteLandingView(
          { status: 'PENDING', expireAt: '2026-09-03T00:00:00.000Z' },
          null,
          now,
        ),
      ).toBe('expired');
      expect(
        resolveCampusInviteLandingView(
          { status: 'PENDING', expireAt: '2026-09-03T01:00:00.000Z' },
          null,
          now,
        ),
      ).toBe('pending');
    });
  });
});
