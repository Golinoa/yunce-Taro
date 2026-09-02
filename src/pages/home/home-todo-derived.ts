/**
 * 首页待办 Tab 派生纯逻辑：今日可见列表、计数、Tab badge、空态高度
 */
import type { TodoViewMode } from '@/components/home/TodoToolbar';
import type { TodoItem } from '@/types/home-todo';
import { isTodoVisibleOnTimelineToday } from '@/utils/todo-timeline';

/** Tab 类型（与首页一致） */
export type HomeTab = 'schedule' | 'todo' | 'recent';

/** 待办空状态 Tab 面板兜底高度（rpx @375） */
export const TODO_EMPTY_PANEL_MIN_HEIGHT_RPX = 520;

export interface HomeTabOption {
  key: HomeTab;
  label: string;
  badge?: number;
}

/** 首页待办 Tab：只展示今日（含逾期滚入） */
export function filterTodayTodoItems(items: TodoItem[]): TodoItem[] {
  return items.filter((item) => isTodoVisibleOnTimelineToday(item));
}

/** 非今日可见条数（进「我的待办」） */
export function countOtherTodoItems(totalCount: number, todayCount: number): number {
  return Math.max(totalCount - todayCount, 0);
}

/** 今日未完成待办数（Tab badge） */
export function countActiveTodoItems(todayItems: TodoItem[]): number {
  return todayItems.filter((item) => !item.completed && !item.completion).length;
}

/**
 * 构建首页 Tab 配置。
 * 待办 badge：仅数量 > 0 且设置开启时显示。
 */
export function buildHomeTabOptions(params: {
  showTodoBadge: boolean;
  activeTodoCount: number;
}): HomeTabOption[] {
  const { showTodoBadge, activeTodoCount } = params;
  return [
    { key: 'schedule', label: '今日课表' },
    {
      key: 'todo',
      label: '待办事项',
      ...(showTodoBadge && activeTodoCount > 0 ? { badge: activeTodoCount } : {}),
    },
    { key: 'recent', label: '最近消课' },
  ];
}

/** 时间轴空态时给面板兜底 minHeight；否则不设 style */
export function resolveTodoEmptyPanelStyle(
  viewMode: TodoViewMode,
  todayTodoCount: number,
): { minHeight: string } | undefined {
  if (viewMode === 'timeline' && todayTodoCount === 0) {
    return { minHeight: `${TODO_EMPTY_PANEL_MIN_HEIGHT_RPX}rpx` };
  }
  return undefined;
}

/** Tab badge 展示文案：>99 显示 99+ */
export function formatTabBadgeText(badgeCount: number): string {
  return badgeCount > 99 ? '99+' : String(badgeCount);
}
