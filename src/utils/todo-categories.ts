/**
 * 我的待办 · 分类（全部 / 收件箱 + 用户自定义）
 *
 * 使用场景：我的待办页分类 Tab；自定义分类存本地 storage，按用户隔离。
 */
import Taro from '@tarojs/taro';

export const TODO_CATEGORY_ALL_ID = 'all';
export const TODO_CATEGORY_INBOX_ID = 'inbox';

const STORAGE_KEY = 'yunce:todo-categories';

export interface TodoCategoryRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

type TodoCategoryStore = Record<string, TodoCategoryRecord[]>;

let _cache: TodoCategoryStore | null = null;

function loadStore(): TodoCategoryStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as TodoCategoryStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

function createCategoryId(): string {
  return `todo-cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 系统 + 自定义分类（UI Tab 用，不含「全部」重复） */
export interface TodoCategoryTab {
  id: string;
  name: string;
  system?: boolean;
}

/** 列表 Tab：全部、收件箱、自定义… */
export function listTodoCategoryTabs(userId: string): TodoCategoryTab[] {
  const custom = (loadStore()[userId] || []).map((item) => ({
    id: item.id,
    name: item.name,
  }));
  return [
    { id: TODO_CATEGORY_ALL_ID, name: '全部', system: true },
    { id: TODO_CATEGORY_INBOX_ID, name: '收件箱', system: true },
    ...custom,
  ];
}

export function addTodoCategory(userId: string, name: string): TodoCategoryRecord | null {
  const trimmed = name.trim();
  if (!userId || !trimmed) return null;
  const store = loadStore();
  const list = store[userId] || [];
  if (list.some((item) => item.name === trimmed)) return null;
  const record: TodoCategoryRecord = {
    id: createCategoryId(),
    userId,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  store[userId] = [...list, record];
  persistStore();
  return record;
}

/** 待办是否属于某分类 Tab */
export function matchTodoCategoryTab(
  categoryId: string | undefined,
  remindEnabled: boolean | undefined,
  tabId: string,
): boolean {
  if (tabId === TODO_CATEGORY_ALL_ID) return true;
  const resolved =
    categoryId ||
    (remindEnabled === false ? TODO_CATEGORY_INBOX_ID : undefined) ||
    TODO_CATEGORY_INBOX_ID;
  return resolved === tabId;
}

/**
 * 解析待办所属分类 id（无分类时统一回落收件箱）。
 * 系统推送、随手记、用户未指定分类的自定义待办均默认进收件箱。
 */
export function resolveTodoCategoryId(item: { todoCategoryId?: string }): string {
  return item.todoCategoryId || TODO_CATEGORY_INBOX_ID;
}

/** TodoItem 是否命中分类 Tab（系统推送默认在收件箱，亦可在「全部」查看） */
export function matchHomeTodoCategoryTab(
  item: {
    todoCategoryId?: string;
  },
  tabId: string,
): boolean {
  if (tabId === TODO_CATEGORY_ALL_ID) return true;
  return resolveTodoCategoryId(item) === tabId;
}
