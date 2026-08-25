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
  completedAt?: string;
  completionNote?: string;
}

export interface AddCustomTodoInput {
  title: string;
  note?: string;
  remindEnabled?: boolean;
  remindDate?: string;
  remindTime?: string;
  quadrant?: TodoQuadrant;
}

export type CustomTodoRemindTone = 'overdue' | 'normal';

export interface CustomTodoRemindMeta {
  tone: CustomTodoRemindTone;
  /** 展示行，逾期示例：逾期1天 · 2026-08-25 23:59 */
  line: string;
  isOverdue: boolean;
  overdueDays: number;
  datetime: string;
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

/** 获取用户自定义待办（含已完成，供时间轴展示） */
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

/** 更新自定义待办象限 */
export function updateCustomTodoQuadrant(
  userId: string,
  todoId: string,
  quadrant: TodoQuadrant,
): boolean {
  if (!userId || !isCustomTodoId(todoId)) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const index = list.findIndex((item) => item.id === todoId);
  if (index < 0) return false;
  list[index] = { ...list[index], quadrant };
  store[userId] = list;
  persistStore();
  return true;
}

/** 完成自定义待办（保留记录，标记完成） */
export function completeCustomTodo(
  userId: string,
  todoId: string,
  completionNote?: string,
): boolean {
  if (!userId || !isCustomTodoId(todoId)) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const index = list.findIndex((item) => item.id === todoId);
  if (index < 0) return false;
  list[index] = {
    ...list[index],
    completedAt: new Date().toISOString(),
    completionNote: completionNote?.trim() || undefined,
  };
  store[userId] = list;
  persistStore();
  return true;
}

/** 重新打开已完成的自定义待办 */
export function reopenCustomTodo(userId: string, todoId: string): boolean {
  if (!userId || !isCustomTodoId(todoId)) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const index = list.findIndex((item) => item.id === todoId);
  if (index < 0) return false;
  list[index] = {
    ...list[index],
    completedAt: undefined,
    completionNote: undefined,
  };
  store[userId] = list;
  persistStore();
  return true;
}

/** 删除自定义待办 */
export function removeCustomTodo(userId: string, todoId: string): boolean {
  if (!userId || !isCustomTodoId(todoId)) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const next = list.filter((item) => item.id !== todoId);
  if (next.length === list.length) return false;
  store[userId] = next;
  persistStore();
  return true;
}

/** 解析自定义待办提醒时刻 */
export function resolveCustomTodoRemindAt(record: CustomTodoRecord): dayjs.Dayjs | null {
  if (record.remindEnabled === false || !record.remindDate) return null;
  const timePart = record.remindTime || '23:59';
  const parsed = dayjs(`${record.remindDate} ${timePart}`);
  return parsed.isValid() ? parsed : null;
}

/** 根据提醒 ISO 时刻构建展示文案（四象限看板等 TodoItem 复用） */
export function buildRemindMetaFromAt(remindAt: string): CustomTodoRemindMeta | null {
  const at = dayjs(remindAt);
  if (!at.isValid()) return null;

  const datetime = at.format('YYYY-MM-DD HH:mm');
  const now = dayjs();

  if (!now.isAfter(at)) {
    return {
      tone: 'normal',
      line: at.format('MM/DD HH:mm'),
      isOverdue: false,
      overdueDays: 0,
      datetime,
    };
  }

  const overdueDays = now.startOf('day').diff(at.startOf('day'), 'day');
  const prefix = overdueDays > 0 ? `逾期${overdueDays}天` : '已逾期';
  return {
    tone: 'overdue',
    line: `${prefix} · ${datetime}`,
    isOverdue: true,
    overdueDays: Math.max(overdueDays, 0),
    datetime,
  };
}

/** 构建自定义待办提醒/逾期展示文案 */
export function buildCustomTodoRemindMeta(record: CustomTodoRecord): CustomTodoRemindMeta | null {
  const remindAt = resolveCustomTodoRemindAt(record);
  if (!remindAt) return null;

  const datetime = remindAt.format('YYYY-MM-DD HH:mm');
  const now = dayjs();

  if (!now.isAfter(remindAt)) {
    return {
      tone: 'normal',
      line: datetime,
      isOverdue: false,
      overdueDays: 0,
      datetime,
    };
  }

  const overdueDays = now.startOf('day').diff(remindAt.startOf('day'), 'day');
  const prefix = overdueDays > 0 ? `逾期${overdueDays}天` : '已逾期';
  return {
    tone: 'overdue',
    line: `${prefix} · ${datetime}`,
    isOverdue: true,
    overdueDays: Math.max(overdueDays, 0),
    datetime,
  };
}

/** 提醒日期文案（首页卡片副标题） */
export function formatCustomTodoRemindDesc(
  remindDate: string | undefined,
  note?: string,
  remindTime?: string,
): string {
  if (!remindDate) {
    return note ? `无提醒 · ${note}` : '无提醒';
  }

  const remindMeta = buildCustomTodoRemindMeta({
    id: '',
    userId: '',
    title: '',
    remindDate,
    remindTime,
    remindEnabled: true,
    createdAt: '',
  });

  if (remindMeta?.isOverdue) {
    return note ? `${remindMeta.line} · ${note}` : remindMeta.line;
  }

  const today = dayjs().startOf('day');
  const target = dayjs(remindDate).startOf('day');
  const diffDays = today.diff(target, 'day');

  let dateLabel: string;
  if (diffDays === 0) {
    dateLabel = '今天提醒';
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

export type CustomTodoSortMode = 'deadline' | 'createdAt' | 'priority';

const QUADRANT_PRIORITY_RANK: Record<string, number> = {
  q1: 0,
  q2: 1,
  q3: 2,
  q4: 3,
};

/** 「我的待办」列表排序：截止日期 / 创建时间 / 优先级 */
export function sortCustomTodosByMode(
  records: CustomTodoRecord[],
  mode: CustomTodoSortMode,
): CustomTodoRecord[] {
  if (mode === 'deadline') {
    return sortCustomTodos(records);
  }

  if (mode === 'createdAt') {
    return [...records].sort(
      (left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf(),
    );
  }

  // 优先级：重要且紧急 > 重要不紧急 > 紧急不重要 > 不紧急不重要；同级再按截止日期
  const byDeadline = sortCustomTodos(records);
  return [...byDeadline].sort((left, right) => {
    const leftRank = QUADRANT_PRIORITY_RANK[left.quadrant || 'q2'] ?? 3;
    const rightRank = QUADRANT_PRIORITY_RANK[right.quadrant || 'q2'] ?? 3;
    return leftRank - rightRank;
  });
}

/** 转为首页待办卡片 */
export function mapCustomTodoToHomeItem(record: CustomTodoRecord, userName?: string): TodoItem {
  const remindEnabled = record.remindEnabled !== false && Boolean(record.remindDate);
  const timePart = record.remindTime || '09:00';
  const remindAt = remindEnabled
    ? dayjs(`${record.remindDate} ${timePart}`).toISOString()
    : undefined;
  const isCompleted = Boolean(record.completedAt);

  return {
    id: record.id,
    title: record.title,
    desc: formatCustomTodoRemindDesc(record.remindDate, record.note, record.remindTime),
    note: record.note,
    remindAt,
    remindEnabled,
    level: getCustomTodoLevel(record.remindDate),
    quadrant: record.quadrant || 'q2',
    category: 'custom',
    actionLabel: '完成',
    sourceType: 'custom',
    sharedScope: 'private',
    displayDay: isCompleted
      ? dayjs(record.completedAt).format('YYYY-MM-DD')
      : record.remindDate || record.createdAt.slice(0, 10),
    completed: isCompleted,
    completion: isCompleted
      ? {
          completedAt: record.completedAt!,
          completedBy: record.userId,
          completedByName: userName || '我',
          note: record.completionNote,
        }
      : undefined,
  };
}

/** 合并 Mock 种子（按 id 去重，不覆盖用户已有数据） */
export function mergeCustomTodoSeeds(userId: string, seeds: CustomTodoRecord[]): void {
  if (!userId || seeds.length === 0) return;
  const store = loadStore();
  const list = store[userId] || [];
  const existingIds = new Set(list.map((item) => item.id));
  const toAdd = seeds
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({ ...item, userId }));
  if (toAdd.length === 0) return;
  store[userId] = [...toAdd, ...list];
  persistStore();
}

/** 刷新已存在的 Mock 种子字段（提醒日期等），保证逾期演示始终有效 */
export function refreshMockCustomTodoSeedFields(
  userId: string,
  seeds: CustomTodoRecord[],
): void {
  if (!userId || seeds.length === 0) return;
  const seedMap = new Map(seeds.map((item) => [item.id, item]));
  const store = loadStore();
  const list = store[userId] || [];
  let changed = false;

  const next = list.map((item) => {
    const seed = seedMap.get(item.id);
    if (!seed) return item;
    changed = true;
    return {
      ...item,
      title: seed.title,
      remindEnabled: seed.remindEnabled,
      remindDate: seed.remindDate,
      remindTime: seed.remindTime,
      quadrant: seed.quadrant,
    };
  });

  if (!changed) return;
  store[userId] = next;
  persistStore();
}

/** 仅测试用 */
export function __resetCustomTodosForTest(): void {
  _cache = {};
}
