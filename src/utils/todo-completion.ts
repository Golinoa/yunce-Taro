/**
 * 待办完成记录（含共享运营待办跨角色同步）
 *
 * 使用场景：系统推送待办点「完成」后保留在时间轴；续费提醒等由任一授权人完成并同步全员。
 */
import Taro from '@tarojs/taro';
import type { TodoCompletion } from '@/types/home-todo';

export const TODO_COMPLETION_STORAGE_KEY = 'yunce:todo-completions';

type CompletionStore = Record<string, TodoCompletion>;

let _cache: CompletionStore | null = null;

function loadStore(): CompletionStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(TODO_COMPLETION_STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as CompletionStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(TODO_COMPLETION_STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

export function getTodoCompletion(todoId: string): TodoCompletion | null {
  return loadStore()[todoId] || null;
}

export function isTodoCompleted(todoId: string): boolean {
  return Boolean(loadStore()[todoId]);
}

export function saveTodoCompletion(todoId: string, completion: TodoCompletion): void {
  const store = loadStore();
  store[todoId] = completion;
  persistStore();
}

export function clearTodoCompletion(todoId: string): void {
  const store = loadStore();
  if (store[todoId]) {
    delete store[todoId];
    persistStore();
  }
}

/** 仅测试用 */
export function __resetTodoCompletionsForTest(): void {
  _cache = {};
}
