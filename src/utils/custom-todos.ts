/**
 * 用户自定义待办（首页待办 Tab）
 *
 * 本地 storage 持久化，按登录用户隔离；提醒日期到达后进入待办列表展示。
 */
import dayjs from 'dayjs';
import Taro from '@tarojs/taro';
import type { TodoLevel } from '@/components/AccentBarCard';
import type { TodoItem } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';

export const CUSTOM_TODO_ID_PREFIX = 'custom-todo-';
export const CUSTOM_TODOS_STORAGE_KEY = 'yunce:custom-todos';

export interface CustomTodoRecord {
  id: string;
  userId: string;
  title: string;
  note?: string;
  /** 提醒日期 YYYY-MM-DD */
  remindDate?: string;
  /** 提醒时间 HH:mm */
  remindTime?: string;
  /** 是否开启提醒，默认 true */
  remindEnabled?: boolean;
  quadrant?: TodoQuadrant;
  createdAt: string;
}

export interface AddCustomTodoInput {
  title: string;
  note?: string;
  remindEnabled?: boolean;
  remindDate?: string;
  remindTime?: string;
  quadrant?: TodoQuadrant;
}

type CustomTodoStore = Record<string, CustomTodoRecord[]>;

let _cache: CustomTodoStore | null = null;

function loadStore(): CustomTodoStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(CUSTOM_TODOS_STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as CustomTodoStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(CUSTOM_TODOS_STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

function createCustomTodoId(): string {
  return `${CUSTOM_TODO_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isCustomTodoId(todoId: string): boolean {
  return todoId.startsWith(CUSTOM_TODO_ID_PREFIX);
}

/** 获取用户未完成的自定义待办 */
export function getCustomTodos(userId: string): CustomTodoRecord[] {
  if (!userId) return [];
  const list = loadStore()[userId] || [];
  return list.filter((item) => item.title.trim());
}

/** 新增自定义待办 */
export function addCustomTodo(userId: string, input: AddCustomTodoInput): CustomTodoRecord {
  const store = loadStore();
  const remindEnabled = input.remindEnabled !== false;
  const record: CustomTodoRecord = {
    id: createCustomTodoId(),
    userId,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    remindEnabled,
    remindDate: remindEnabled ? input.remindDate || dayjs().format('YYYY-MM-DD') : undefined,
    remindTime: remindEnabled ? input.remindTime || '09:00' : undefined,
    quadrant: input.quadrant || 'q2',
    createdAt: new Date().toISOString(),
  };
  const list = store[userId] || [];
  store[userId] = [record, ...list];
  persistStore();
  return record;
}

/** 完成（删除）自定义待办 */
export function completeCustomTodo(userId: string, todoId: string): boolean {
  if (!userId || !isCustomTodoId(todoId)) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const next = list.filter((item) => item.id !== todoId);
  if (next.length === list.length) return false;
  store[userId] = next;
  persistStore();
  return true;
}

/** 提醒日期文案 */
export function formatCustomTodoRemindDesc(remindDate: string | undefined, note?: string): string {
  if (!remindDate) {
    return note ? `无提醒 · ${note}` : '无提醒';
  }
  const today = dayjs().startOf('day');
  const target = dayjs(remindDate).startOf('day');
  const diffDays = today.diff(target, 'day');

  let dateLabel: string;
  if (diffDays === 0) {
    dateLabel = '今天提醒';
  } else if (diffDays === 1) {
    dateLabel = '昨天提醒';
  } else if (diffDays > 1) {
    dateLabel = `已逾期 ${diffDays} 天`;
  } else if (diffDays === -1) {
    dateLabel = '明天提醒';
  } else {
    dateLabel = `${target.format('M月D日')} 提醒`;
  }

  return note ? `${dateLabel} · ${note}` : dateLabel;
}

/** 根据提醒日期计算色条等级 */
export function getCustomTodoLevel(remindDate: string | undefined): TodoLevel {
  if (!remindDate) return 'low';
  const diffDays = dayjs().startOf('day').diff(dayjs(remindDate).startOf('day'), 'day');
  if (diffDays > 0) return 'urgent';
  if (diffDays === 0) return 'high';
  return 'low';
}

/** 自定义待办排序：逾期 > 今天 > 未来（按日期升序） */
export function sortCustomTodos(records: CustomTodoRecord[]): CustomTodoRecord[] {
  return [...records].sort((left, right) => {
    const leftDate = left.remindDate || left.createdAt.slice(0, 10);
    const rightDate = right.remindDate || right.createdAt.slice(0, 10);
    const leftTs = dayjs(leftDate).valueOf();
    const rightTs = dayjs(rightDate).valueOf();
    const leftDiff = dayjs().startOf('day').diff(dayjs(leftDate).startOf('day'), 'day');
    const rightDiff = dayjs().startOf('day').diff(dayjs(rightDate).startOf('day'), 'day');

    const leftBucket = leftDiff > 0 ? 0 : leftDiff === 0 ? 1 : 2;
    const rightBucket = rightDiff > 0 ? 0 : rightDiff === 0 ? 1 : 2;
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;
    if (leftBucket === 2) return leftTs - rightTs;
    return rightTs - leftTs;
  });
}

/** 转为首页待办卡片 */
export function mapCustomTodoToHomeItem(record: CustomTodoRecord): TodoItem {
  const remindEnabled = record.remindEnabled !== false && Boolean(record.remindDate);
  const timePart = record.remindTime || '09:00';
  const remindAt = remindEnabled
    ? dayjs(`${record.remindDate} ${timePart}`).toISOString()
    : undefined;

  return {
    id: record.id,
    title: record.title,
    desc: formatCustomTodoRemindDesc(record.remindDate, record.note),
    note: record.note,
    remindAt,
    remindEnabled,
    level: getCustomTodoLevel(record.remindDate),
    quadrant: record.quadrant || 'q2',
    category: 'custom',
    actionLabel: '完成',
  };
}

/** 仅测试用 */
export function __resetCustomTodosForTest(): void {
  _cache = {};
}
