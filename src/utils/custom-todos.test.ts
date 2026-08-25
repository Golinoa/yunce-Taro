import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_TODOS_STORAGE_KEY,
  addCustomTodo,
  buildCustomTodoRemindMeta,
  completeCustomTodo,
  formatCustomTodoRemindDesc,
  getCustomTodoLevel,
  getCustomTodos,
  isCustomTodoId,
  mapCustomTodoToHomeItem,
  sortCustomTodos,
  __resetCustomTodosForTest,
} from './custom-todos';

describe('custom-todos', () => {
  beforeEach(() => {
    Taro.removeStorageSync(CUSTOM_TODOS_STORAGE_KEY);
    __resetCustomTodosForTest();
  });

  it('新增并读取自定义待办', () => {
    const record = addCustomTodo('user-1', {
      title: '联系家长',
      note: '续费',
      remindDate: '2026-08-25',
    });
    expect(record.userId).toBe('user-1');
    expect(getCustomTodos('user-1')).toHaveLength(1);
    expect(isCustomTodoId(record.id)).toBe(true);
  });

  it('完成后从列表移除', () => {
    const record = addCustomTodo('user-1', {
      title: '备课',
      remindDate: '2026-08-25',
    });
    expect(completeCustomTodo('user-1', record.id)).toBe(true);
    expect(getCustomTodos('user-1')).toHaveLength(0);
  });

  it('映射为首页待办卡片', () => {
    const record = addCustomTodo('user-1', {
      title: '回访试听',
      remindDate: '2026-08-25',
    });
    const item = mapCustomTodoToHomeItem(record);
    expect(item.category).toBe('custom');
    expect(item.actionLabel).toBe('完成');
    expect(item.title).toBe('回访试听');
  });

  it('逾期待办等级为 urgent', () => {
    expect(getCustomTodoLevel('2020-01-01')).toBe('urgent');
    expect(formatCustomTodoRemindDesc('2020-01-01')).toContain('逾期');
  });

  it('逾期提醒文案：逾期N天 · 截止日期时间', () => {
    const meta = buildCustomTodoRemindMeta({
      id: 'x',
      userId: 'u',
      title: '测试',
      remindDate: '2026-08-25',
      remindTime: '23:59',
      remindEnabled: true,
      createdAt: '2026-08-20T00:00:00.000Z',
    });
    expect(meta?.isOverdue).toBe(true);
    expect(meta?.line).toMatch(/^逾期\d+天 · 2026-08-25 23:59$/);
  });

  it('排序：逾期优先于今天，今天优先于未来', () => {
    const sorted = sortCustomTodos([
      {
        id: 'a',
        userId: 'u',
        title: '未来',
        remindDate: '2099-01-01',
        createdAt: '',
      },
      {
        id: 'b',
        userId: 'u',
        title: '逾期',
        remindDate: '2020-01-01',
        createdAt: '',
      },
      {
        id: 'c',
        userId: 'u',
        title: '今天',
        remindDate: new Date().toISOString().slice(0, 10),
        createdAt: '',
      },
    ]);
    expect(sorted.map((item) => item.title)).toEqual(['逾期', '今天', '未来']);
  });
});
