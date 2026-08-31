/**
 * 系统待办参与人覆盖（续费 campus_ops 等）
 *
 * Mock：手动增删参与人后的持久化源。
 * 真实模式：PUT 成功后的客户端缓存；列表 enrich 时合并。
 */
import Taro from '@tarojs/taro';

export const TODO_ASSIGNEE_OVERRIDE_STORAGE_KEY = 'yunce:todo-assignee-overrides';

type OverrideStore = Record<string, string[]>;

let _cache: OverrideStore | null = null;

function loadStore(): OverrideStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(TODO_ASSIGNEE_OVERRIDE_STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as OverrideStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(TODO_ASSIGNEE_OVERRIDE_STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

export function getTodoAssigneeOverride(todoId: string): string[] | null {
  if (!todoId) return null;
  const ids = loadStore()[todoId];
  return Array.isArray(ids) ? [...ids] : null;
}

export function saveTodoAssigneeOverride(todoId: string, teacherIds: string[]): void {
  if (!todoId) return;
  const store = loadStore();
  store[todoId] = [...teacherIds];
  persistStore();
}

/** 仅测试用 */
export function __resetTodoAssigneeOverridesForTest(): void {
  _cache = {};
}
