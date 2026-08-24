import Taro from '@tarojs/taro';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_TODO_SETTINGS,
  TODO_SETTINGS_KEY,
  filterTodosBySettings,
  getTodoSettings,
  saveTodoSettings,
  setTodoSettingKey,
} from './todo-settings';

describe('todo-settings', () => {
  beforeEach(() => {
    Taro.removeStorageSync(TODO_SETTINGS_KEY);
  });

  it('默认全开', () => {
    expect(getTodoSettings()).toEqual(DEFAULT_TODO_SETTINGS);
  });

  it('关闭续费提醒后过滤 studentRecharge 类待办', () => {
    saveTodoSettings({ studentRecharge: false });
    const items = filterTodosBySettings([
      { id: '1', category: 'studentRecharge' },
      { id: '2', category: 'attendanceCheckin' },
    ]);
    expect(items.map((i) => i.id)).toEqual(['2']);
  });

  it('setTodoSettingKey 持久化并可读回', () => {
    setTodoSettingKey('showTabBadge', false);
    expect(getTodoSettings().showTabBadge).toBe(false);
  });
});
