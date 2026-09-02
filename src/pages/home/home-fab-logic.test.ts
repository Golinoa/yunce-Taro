/**
 * 首页 FAB 纯逻辑单测
 */
import { describe, expect, it } from 'vitest';
import {
  FAB_REVEAL_BOTTOM_OFFSET_RPX,
  FAB_REVEAL_TAB_GAP_RPX,
  FAB_VIEW_TOGGLE_DELAY_MS,
  fabViewToggleIcon,
  fabViewToggleLabel,
  nextTodoViewMode,
  shouldRevealHomeFab,
} from './home-fab-logic';

describe('FAB constants', () => {
  it('保持与 ExpandableFabMenu / 首页既有口径一致', () => {
    expect(FAB_REVEAL_BOTTOM_OFFSET_RPX).toBe(48);
    expect(FAB_REVEAL_TAB_GAP_RPX).toBe(300);
    expect(FAB_VIEW_TOGGLE_DELAY_MS).toBe(220);
  });
});

describe('nextTodoViewMode', () => {
  it('timeline ↔ quadrant 互切', () => {
    expect(nextTodoViewMode('timeline')).toBe('quadrant');
    expect(nextTodoViewMode('quadrant')).toBe('timeline');
  });
});

describe('fabViewToggleLabel / fabViewToggleIcon', () => {
  it('当前 timeline 提示切到卡片视图', () => {
    expect(fabViewToggleLabel('timeline')).toBe('卡片视图');
    expect(fabViewToggleIcon('timeline')).toBe('mdi-view-grid-outline');
  });

  it('当前 quadrant 提示切到列表视图', () => {
    expect(fabViewToggleLabel('quadrant')).toBe('列表视图');
    expect(fabViewToggleIcon('quadrant')).toBe('mdi-format-list-bulleted');
  });
});

describe('shouldRevealHomeFab', () => {
  const windowWidth = 375;

  it('rect 缺失或为数组时不展示', () => {
    expect(
      shouldRevealHomeFab({
        scrollViewRect: null,
        anchorRect: { top: 100, height: 1, bottom: 101 },
        windowWidth,
      }),
    ).toBe(false);
    expect(
      shouldRevealHomeFab({
        scrollViewRect: { top: 0, height: 800, bottom: 800 },
        anchorRect: [],
        windowWidth,
      }),
    ).toBe(false);
  });

  it('windowWidth 无效时不展示', () => {
    expect(
      shouldRevealHomeFab({
        scrollViewRect: { top: 0, height: 800, bottom: 800 },
        anchorRect: { top: 100, height: 1, bottom: 101 },
        windowWidth: 0,
      }),
    ).toBe(false);
  });

  it('Tab 下方空隙大于禁区时展示', () => {
    // bottomOffsetPx = 48*375/750 = 24；tabGapPx = 300*375/750 = 150
    // scrollViewportBottom = 0+800-24 = 776；gap = 776-100 = 676 > 150
    expect(
      shouldRevealHomeFab({
        scrollViewRect: { top: 0, height: 800, bottom: 800 },
        anchorRect: { top: 99, height: 1, bottom: 100 },
        windowWidth,
      }),
    ).toBe(true);
  });

  it('Tab 下方空隙不足禁区时不展示', () => {
    // gap = (0+200-24) - 180 = -4 → false
    expect(
      shouldRevealHomeFab({
        scrollViewRect: { top: 0, height: 200, bottom: 200 },
        anchorRect: { top: 179, height: 1, bottom: 180 },
        windowWidth,
      }),
    ).toBe(false);
  });
});
