/**
 * 首页 FAB 纯逻辑：显隐几何判定、视图切换下一态、菜单文案/图标
 * 交互约束：视图切换仍须走页面内 handleTodoViewModeChange；蒙层用 useOverlayScrollFreeze。
 */
import type { TodoViewMode } from '@/components/home/TodoToolbar';

/** FAB 距屏幕底的安全边距（rpx），与 ExpandableFabMenu 对齐 */
export const FAB_REVEAL_BOTTOM_OFFSET_RPX = 48;
/** Tab 标签行下方禁区（rpx）：视口底到 Tab 底不足该高度时不显示 FAB */
export const FAB_REVEAL_TAB_GAP_RPX = 300;
/** FAB 菜单收起后，再触发工具栏同款视图切换（毫秒） */
export const FAB_VIEW_TOGGLE_DELAY_MS = 220;

export interface BoundingRectLike {
  top: number;
  height: number;
  bottom: number;
}

function isValidRect(rect: unknown): rect is BoundingRectLike {
  if (!rect || Array.isArray(rect) || typeof rect !== 'object') return false;
  const r = rect as BoundingRectLike;
  return typeof r.top === 'number' && typeof r.height === 'number' && typeof r.bottom === 'number';
}

/**
 * 根据 ScrollView / Tab 锚点几何与窗口宽度判定是否展示 FAB。
 * 与首页原 updateFabVisibility 口径一致。
 */
export function shouldRevealHomeFab(params: {
  scrollViewRect: unknown;
  anchorRect: unknown;
  windowWidth: number;
  bottomOffsetRpx?: number;
  tabGapRpx?: number;
}): boolean {
  const { scrollViewRect, anchorRect, windowWidth } = params;
  if (!isValidRect(scrollViewRect) || !isValidRect(anchorRect)) {
    return false;
  }
  if (!(windowWidth > 0)) {
    return false;
  }

  const bottomOffsetRpx = params.bottomOffsetRpx ?? FAB_REVEAL_BOTTOM_OFFSET_RPX;
  const tabGapRpx = params.tabGapRpx ?? FAB_REVEAL_TAB_GAP_RPX;
  const bottomOffsetPx = (bottomOffsetRpx * windowWidth) / 750;
  const tabGapPx = (tabGapRpx * windowWidth) / 750;
  const scrollViewportBottom = scrollViewRect.top + scrollViewRect.height - bottomOffsetPx;
  const gapBelowTab = scrollViewportBottom - anchorRect.bottom;

  return gapBelowTab > tabGapPx;
}

/** timeline ↔ quadrant 下一态（FAB「卡片/列表视图」） */
export function nextTodoViewMode(current: TodoViewMode): TodoViewMode {
  return current === 'timeline' ? 'quadrant' : 'timeline';
}

/** FAB「视图切换」菜单文案：当前 timeline 时提示切到卡片，反之列表 */
export function fabViewToggleLabel(mode: TodoViewMode): string {
  return mode === 'timeline' ? '卡片视图' : '列表视图';
}

/** FAB「视图切换」菜单图标 */
export function fabViewToggleIcon(mode: TodoViewMode): string {
  return mode === 'timeline' ? 'mdi-view-grid-outline' : 'mdi-format-list-bulleted';
}
