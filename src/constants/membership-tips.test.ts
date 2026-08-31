import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from '@tarojs/taro';
import {
  DEFAULT_MEMBERSHIP_TIPS,
  dismissMembershipTip,
  loadDismissedTipIds,
  matchMembershipTip,
  mergeMembershipTips,
  resolveLifecycle,
  type MembershipTipDef,
} from '@/constants/membership-tips';
import type { OrganizationQuotaUsage } from '@/services/organization';

const DISMISS_KEY = 'yunce:membership-tip-dismiss';

function quota(
  partial: Partial<OrganizationQuotaUsage> & Pick<OrganizationQuotaUsage, 'versionCode'>,
): OrganizationQuotaUsage {
  return {
    organizationId: 'org-1',
    organizationName: '测试机构',
    versionName: partial.versionName ?? '标准版',
    expireAt: partial.expireAt ?? null,
    members: partial.members ?? { current: 10, max: 220 },
    employees: partial.employees ?? { current: 1, max: 8 },
    campuses: partial.campuses ?? { current: 1, max: 1 },
    features: partial.features ?? { leadTrace: true, batchImportExport: false },
    ...partial,
  };
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

describe('resolveLifecycle', () => {
  it('空配额视为未开通', () => {
    expect(resolveLifecycle(null)).toBe('inactive');
    expect(resolveLifecycle(undefined)).toBe('inactive');
  });

  it('FREE / TRIAL 视为未开通；带过期日走 expired', () => {
    expect(resolveLifecycle(quota({ versionCode: 'FREE' }))).toBe('inactive');
    expect(resolveLifecycle(quota({ versionCode: 'TRIAL' }))).toBe('inactive');
    expect(
      resolveLifecycle(quota({ versionCode: 'FREE', expireAt: daysFromNow(-2) })),
    ).toBe('expired');
  });

  it('付费：过期 / ≤7 天 / ≤30 天 / 长期 / 无到期日', () => {
    expect(
      resolveLifecycle(quota({ versionCode: 'STANDARD', expireAt: daysFromNow(-1) })),
    ).toBe('expired');
    expect(
      resolveLifecycle(quota({ versionCode: 'BASIC', expireAt: daysFromNow(3) })),
    ).toBe('expiring_7');
    expect(
      resolveLifecycle(quota({ versionCode: 'BASIC', expireAt: daysFromNow(20) })),
    ).toBe('expiring_30');
    expect(
      resolveLifecycle(quota({ versionCode: 'FLAGSHIP', expireAt: daysFromNow(90) })),
    ).toBe('active');
    expect(resolveLifecycle(quota({ versionCode: 'STANDARD', expireAt: null }))).toBe('active');
  });
});

describe('matchMembershipTip', () => {
  const active = () => daysFromNow(90);

  it('无配额返回 null；众创命中 N-A', () => {
    expect(matchMembershipTip(null)).toBeNull();
    expect(matchMembershipTip(quota({ versionCode: 'FREE' }))?.tipId).toBe('N-A');
  });

  it('到期召回、快到期模板 {n}、将到期 W-A', () => {
    expect(
      matchMembershipTip(quota({ versionCode: 'STANDARD', expireAt: daysFromNow(-1) }))?.tipId,
    ).toBe('E-A');

    const soon = matchMembershipTip(
      quota({ versionCode: 'STANDARD', expireAt: daysFromNow(5) }),
    );
    expect(soon?.tipId).toBe('X-A');
    expect(soon?.title).toContain('5');

    expect(
      matchMembershipTip(quota({ versionCode: 'STANDARD', expireAt: daysFromNow(15) }))?.tipId,
    ).toBe('W-A');
  });

  it('trigger：会员满 / 员工满 / 双满 / 会员将满 / 员工将满', () => {
    expect(
      matchMembershipTip(
        quota({
          versionCode: 'STANDARD',
          expireAt: active(),
          members: { current: 220, max: 220 },
          employees: { current: 2, max: 8 },
        }),
      )?.tipId,
    ).toBe('A-MEM');

    expect(
      matchMembershipTip(
        quota({
          versionCode: 'STANDARD',
          expireAt: active(),
          members: { current: 10, max: 220 },
          employees: { current: 8, max: 8 },
        }),
      )?.tipId,
    ).toBe('A-EMP');

    expect(
      matchMembershipTip(
        quota({
          versionCode: 'STANDARD',
          expireAt: active(),
          members: { current: 220, max: 220 },
          employees: { current: 8, max: 8 },
        }),
      )?.tipId,
    ).toBe('A-BOTH');

    const memWarn = matchMembershipTip(
      quota({
        versionCode: 'STANDARD',
        expireAt: active(),
        members: { current: 200, max: 220 },
        employees: { current: 1, max: 8 },
      }),
    );
    expect(memWarn?.tipId).toBe('A-MEM-W');
    expect(memWarn?.title).toContain('200/220');

    // max=10 时 9/10≥90% 且未满，才能命中 employees_warn
    const empWarn = matchMembershipTip(
      quota({
        versionCode: 'STANDARD',
        expireAt: active(),
        members: { current: 10, max: 220 },
        employees: { current: 9, max: 10 },
      }),
      [
        {
          tipId: 'EW',
          scene: 't',
          tone: 'warn',
          priority: 1,
          lifecycles: ['active'],
          trigger: 'employees_warn',
          title: '员工 {used}/{max}',
          body: 'x',
        },
      ],
    );
    expect(empWarn?.tipId).toBe('EW');
    expect(empWarn?.title).toBe('员工 9/10');
  });

  it('不限额度不触发满/将满；未知 trigger / 空列表无匹配', () => {
    expect(
      matchMembershipTip(
        quota({
          versionCode: 'FLAGSHIP',
          expireAt: active(),
          members: { current: 9999, max: -1 },
          employees: { current: 999, max: 99999 },
        }),
        DEFAULT_MEMBERSHIP_TIPS.filter((t) =>
          ['members_full', 'employees_full', 'both_full', 'members_warn', 'employees_warn'].includes(
            t.trigger,
          ),
        ),
      ),
    ).toBeNull();

    expect(
      matchMembershipTip(quota({ versionCode: 'STANDARD', expireAt: active() }), [
        {
          tipId: 'BAD',
          scene: 't',
          tone: 'ok',
          priority: 1,
          lifecycles: ['active'],
          trigger: 'not_a_trigger' as MembershipTipDef['trigger'],
          title: 'x',
          body: 'y',
        },
      ]),
    ).toBeNull();

    expect(
      matchMembershipTip(quota({ versionCode: 'STANDARD', expireAt: active() }), []),
    ).toBeNull();
  });

  it('关闭 tip 后回退；到期+会员满走 E-MEM', () => {
    const past = daysFromNow(-1);
    expect(
      matchMembershipTip(
        quota({ versionCode: 'STANDARD', expireAt: past }),
        DEFAULT_MEMBERSHIP_TIPS,
        ['E-A'],
      )?.tipId,
    ).not.toBe('E-A');

    expect(
      matchMembershipTip(
        quota({
          versionCode: 'STANDARD',
          expireAt: past,
          members: { current: 220, max: 220 },
          employees: { current: 1, max: 8 },
        }),
        DEFAULT_MEMBERSHIP_TIPS,
        ['E-A'],
      )?.tipId,
    ).toBe('E-MEM');
  });

  it('max<=0 不触发将满；空存储返回 []', () => {
    expect(
      matchMembershipTip(
        quota({
          versionCode: 'STANDARD',
          expireAt: daysFromNow(90),
          members: { current: 1, max: 0 },
          employees: { current: 0, max: 0 },
        }),
        DEFAULT_MEMBERSHIP_TIPS.filter((t) =>
          t.trigger === 'members_warn' || t.trigger === 'employees_warn',
        ),
      ),
    ).toBeNull();

    Taro.removeStorageSync(DISMISS_KEY);
    expect(loadDismissedTipIds()).toEqual([]);
  });
});

describe('mergeMembershipTips', () => {
  it('空覆盖原样返回', () => {
    expect(mergeMembershipTips(DEFAULT_MEMBERSHIP_TIPS, null)).toBe(DEFAULT_MEMBERSHIP_TIPS);
    expect(mergeMembershipTips(DEFAULT_MEMBERSHIP_TIPS, [])).toBe(DEFAULT_MEMBERSHIP_TIPS);
  });

  it('同 tipId 覆盖；新 tipId 追加；仅 tipId 走默认字段；跳过空 tipId', () => {
    const merged = mergeMembershipTips(DEFAULT_MEMBERSHIP_TIPS, [
      { tipId: 'E-A', title: '运营覆盖标题', body: '运营覆盖正文' },
      {
        tipId: 'NEW-1',
        title: '新话术',
        body: '新正文',
        tone: 'ok',
        priority: 5,
        trigger: 'always',
        scene: '运营新增',
      },
      { tipId: 'ONLY-ID' },
      { tipId: '', title: '应跳过' },
    ]);
    expect(merged.find((t) => t.tipId === 'E-A')?.title).toBe('运营覆盖标题');
    expect(merged.find((t) => t.tipId === 'E-A')?.tone).toBe('urgent');
    expect(merged.find((t) => t.tipId === 'NEW-1')?.priority).toBe(5);
    const only = merged.find((t) => t.tipId === 'ONLY-ID');
    expect(only).toMatchObject({
      tipId: 'ONLY-ID',
      scene: '',
      tone: 'up',
      priority: 100,
      title: '',
      body: '',
      trigger: 'always',
    });
    expect(merged.some((t) => t.title === '应跳过')).toBe(false);
  });
});

describe('dismissMembershipTip / loadDismissedTipIds', () => {
  beforeEach(() => {
    Taro.removeStorageSync(DISMISS_KEY);
  });

  it('关闭后可读出；过期记录被过滤', () => {
    dismissMembershipTip('E-A');
    expect(loadDismissedTipIds()).toContain('E-A');

    const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
    Taro.setStorageSync(
      DISMISS_KEY,
      JSON.stringify({ 'E-A': stale, 'X-A': Date.now() }),
    );
    const ids = loadDismissedTipIds();
    expect(ids).toContain('X-A');
    expect(ids).not.toContain('E-A');
  });

  it('损坏存储与读写异常时安全降级', () => {
    Taro.setStorageSync(DISMISS_KEY, '{not-json');
    expect(loadDismissedTipIds()).toEqual([]);

    const getSpy = vi.spyOn(Taro, 'getStorageSync').mockImplementation(() => {
      throw new Error('storage down');
    });
    expect(loadDismissedTipIds()).toEqual([]);
    dismissMembershipTip('E-A');
    getSpy.mockRestore();

    const setSpy = vi.spyOn(Taro, 'setStorageSync').mockImplementation(() => {
      throw new Error('write fail');
    });
    expect(() => dismissMembershipTip('X-A')).not.toThrow();
    setSpy.mockRestore();
  });
});
