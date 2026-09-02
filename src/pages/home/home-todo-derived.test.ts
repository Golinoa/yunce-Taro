/**
 * 首页待办派生纯逻辑单测
 */
import { describe, expect, it, vi } from 'vitest';
import type { TodoItem } from '@/types/home-todo';
import {
  TODO_EMPTY_PANEL_MIN_HEIGHT_RPX,
  buildHomeTabOptions,
  countActiveTodoItems,
  countOtherTodoItems,
  filterTodayTodoItems,
  formatTabBadgeText,
  resolveTodoEmptyPanelStyle,
} from './home-todo-derived';

vi.mock('@/utils/todo-timeline', () => ({
  isTodoVisibleOnTimelineToday: (item: TodoItem) => item.id.startsWith('today-'),
}));

function makeTodo(overrides: Partial<TodoItem> & Pick<TodoItem, 'id'>): TodoItem {
  return {
    title: 't',
    desc: '',
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterTodayTodoItems / counts', () => {
  it('仅保留今日可见项', () => {
    const items = [
      makeTodo({ id: 'today-1' }),
      makeTodo({ id: 'other-1' }),
      makeTodo({ id: 'today-2', completed: true }),
    ];
    const today = filterTodayTodoItems(items);
    expect(today.map((t) => t.id)).toEqual(['today-1', 'today-2']);
    expect(countOtherTodoItems(items.length, today.length)).toBe(1);
  });

  it('active 计数排除已完成与带 completion 的项', () => {
    const today = [
      makeTodo({ id: 'today-1' }),
      makeTodo({ id: 'today-2', completed: true }),
      makeTodo({
        id: 'today-3',
        completion: {
          completedBy: 'u1',
          completedByName: '我',
          completedAt: '2026-09-03',
        },
      }),
    ];
    expect(countActiveTodoItems(today)).toBe(1);
  });
});

describe('buildHomeTabOptions', () => {
  it('badge 关闭或数量为 0 时不带 badge', () => {
    expect(buildHomeTabOptions({ showTodoBadge: false, activeTodoCount: 3 })).toEqual([
      { key: 'schedule', label: '今日课表' },
      { key: 'todo', label: '待办事项' },
      { key: 'recent', label: '最近消课' },
    ]);
    expect(buildHomeTabOptions({ showTodoBadge: true, activeTodoCount: 0 })[1].badge).toBe(
      undefined,
    );
  });

  it('badge 开启且有未完成数时挂到待办 Tab', () => {
    const tabs = buildHomeTabOptions({ showTodoBadge: true, activeTodoCount: 5 });
    expect(tabs[1]).toEqual({ key: 'todo', label: '待办事项', badge: 5 });
  });
});

describe('resolveTodoEmptyPanelStyle / formatTabBadgeText', () => {
  it('timeline 空态返回兜底 minHeight', () => {
    expect(resolveTodoEmptyPanelStyle('timeline', 0)).toEqual({
      minHeight: `${TODO_EMPTY_PANEL_MIN_HEIGHT_RPX}rpx`,
    });
    expect(resolveTodoEmptyPanelStyle('timeline', 1)).toBeUndefined();
    expect(resolveTodoEmptyPanelStyle('quadrant', 0)).toBeUndefined();
  });

  it('badge >99 显示 99+', () => {
    expect(formatTabBadgeText(9)).toBe('9');
    expect(formatTabBadgeText(99)).toBe('99');
    expect(formatTabBadgeText(100)).toBe('99+');
  });
});

describe('TODO_EMPTY_PANEL_MIN_HEIGHT_RPX', () => {
  it('保持既有空态高度口径', () => {
    expect(TODO_EMPTY_PANEL_MIN_HEIGHT_RPX).toBe(520);
  });
});
