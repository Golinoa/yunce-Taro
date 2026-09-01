import { describe, expect, it } from 'vitest';
import {
  PROFILE_STORE_FORBIDDEN_LABELS,
  PROFILE_SYSTEM_FORBIDDEN_LABELS,
  assertProfileMenuLabels,
} from './profile-menu-labels';

describe('profile-menu-labels', () => {
  it('禁止店铺管理出现约课规则与学员转校', () => {
    expect(PROFILE_STORE_FORBIDDEN_LABELS).toContain('约课规则');
    expect(PROFILE_STORE_FORBIDDEN_LABELS).toContain('学员转校');
  });

  it('禁止系统管理出现切换身份', () => {
    expect(PROFILE_SYSTEM_FORBIDDEN_LABELS).toContain('切换身份');
  });

  it('assert 能检出违规标签', () => {
    expect(assertProfileMenuLabels(['员工管理', '切换身份']).ok).toBe(false);
    expect(assertProfileMenuLabels(['员工管理', '课程管理']).ok).toBe(true);
  });
});
