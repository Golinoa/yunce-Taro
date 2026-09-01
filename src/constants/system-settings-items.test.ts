import { describe, expect, it } from 'vitest';
import { SYSTEM_SETTING_ITEMS } from './system-settings-items';

describe('system-settings-items', () => {
  it('约课规则在系统设置且仅管理员/校长可见', () => {
    const booking = SYSTEM_SETTING_ITEMS.find((item) => item.title === '约课规则');
    expect(booking).toBeDefined();
    expect(booking?.route).toBe('/package-course/pages/booking-rule/index');
    expect(booking?.managerOnly).toBe(true);
  });

  it('不含切换身份', () => {
    expect(SYSTEM_SETTING_ITEMS.some((item) => item.title.includes('切换身份'))).toBe(false);
  });
});
