import { describe, expect, it } from 'vitest';
import {
  formatStorefrontStudents,
  formatStorefrontTitle,
  isSameOrgStorefront,
  storefrontKey,
  storefrontKeyOf,
} from '@/utils/parent-storefront';

describe('parent-storefront helpers', () => {
  it('storefrontKey 含 org 与 campus，避免跨机构撞车', () => {
    expect(storefrontKey('org-a', 'campus-1')).toBe('org-a:campus-1');
    expect(storefrontKeyOf({ organizationId: 'org-b', campusId: 'campus-1' })).toBe(
      'org-b:campus-1',
    );
  });

  it('formatStorefrontTitle：机构 · 校区', () => {
    expect(formatStorefrontTitle({ organizationName: '云策艺术', campusName: '总校区' })).toBe(
      '云策艺术 · 总校区',
    );
    expect(formatStorefrontTitle({ organizationName: '', campusName: '城东' })).toBe('城东');
  });

  it('formatStorefrontStudents 拼接学员昵称', () => {
    expect(
      formatStorefrontStudents({
        students: [
          { id: '1', name: '小明' },
          { id: '2', name: '小红' },
        ],
      }),
    ).toBe('学员：小明、小红');
    expect(formatStorefrontStudents({ students: [] })).toBe('');
  });

  it('isSameOrgStorefront 仅比较 organizationId', () => {
    expect(isSameOrgStorefront({ organizationId: 'org-a' }, 'org-a')).toBe(true);
    expect(isSameOrgStorefront({ organizationId: 'org-b' }, 'org-a')).toBe(false);
    expect(isSameOrgStorefront({ organizationId: 'org-a' }, null)).toBe(false);
  });
});
