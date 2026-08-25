/**
 * 待办四象限覆盖（用户重分配事态等级）
 *
 * 使用场景：
 * - Mock：拖拽后的唯一持久化源
 * - 真实模式：PUT 成功后的客户端缓存；GET /home/teacher/todos 带回的
 *   `quadrantOverrides` 也会写入本表，供 enrichTodoItem 使用
 *
 * 契约：`docs/todo/07-todo-quadrant-api-contract.md`
 */
import Taro from '@tarojs/taro';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export const TODO_QUADRANT_OVERRIDE_STORAGE_KEY = 'yunce:todo-quadrant-overrides';

type OverrideStore = Record<string, Record<string, TodoQuadrant>>;

let _cache: OverrideStore | null = null;

function loadStore(): OverrideStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(TODO_QUADRANT_OVERRIDE_STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as OverrideStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(TODO_QUADRANT_OVERRIDE_STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

export function getTodoQuadrantOverride(userId: string, todoId: string): TodoQuadrant | null {
  if (!userId || !todoId) return null;
  return loadStore()[userId]?.[todoId] || null;
}

export function saveTodoQuadrantOverride(
  userId: string,
  todoId: string,
  quadrant: TodoQuadrant,
): void {
  if (!userId || !todoId) return;
  const store = loadStore();
  const userMap = store[userId] || {};
  userMap[todoId] = quadrant;
  store[userId] = userMap;
  persistStore();
}

/** 仅测试用 */
export function __resetTodoQuadrantOverridesForTest(): void {
  _cache = {};
}
