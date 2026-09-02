/* eslint-disable import/order, import/newline-after-import */
/**
 * 课表 Tab 布局常量单测
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  default: {
    getWindowInfo: () => ({ windowWidth: 375 }),
  },
}));
/* eslint-disable import/first */
import {
  TAB_COUNT_PER_SCREEN,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
  getTabContainerWidth,
  rpxToPx,
} from './schedule-tab-layout';
/* eslint-enable import/first */

describe('schedule-tab-layout constants', () => {
  it('TAB_WIDTH_RPX 由屏宽与固定区推算', () => {
    const expected =
      (750 - TAB_RIGHT_FIXED_WIDTH_RPX - (TAB_COUNT_PER_SCREEN - 1) * TAB_GAP_RPX) /
      TAB_COUNT_PER_SCREEN;
    expect(TAB_WIDTH_RPX).toBe(expected);
    expect(TAB_WIDTH_RPX).toBeCloseTo(105.33, 1);
  });

  it('getTabContainerWidth 含 Tab 宽与间隙', () => {
    const tabCount = 5;
    expect(getTabContainerWidth(tabCount)).toBe(
      tabCount * TAB_WIDTH_RPX + (tabCount - 1) * TAB_GAP_RPX,
    );
  });

  it('rpxToPx 按 windowWidth 375 换算', () => {
    expect(rpxToPx(750)).toBe(375);
    expect(rpxToPx(TAB_WIDTH_RPX)).toBeCloseTo(52.67, 1);
  });
});
