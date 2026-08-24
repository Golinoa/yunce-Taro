/**
 * 用户笔记（本地 storage）
 */
import dayjs from 'dayjs';
import Taro from '@tarojs/taro';

export const USER_NOTES_STORAGE_KEY = 'yunce:user-notes';

export type NoteTagColor = 'default' | 'primary' | 'accent' | 'warning';

export interface UserNoteRecord {
  id: string;
  userId: string;
  content: string;
  folder: string;
  tagColor: NoteTagColor;
  createdAt: string;
  updatedAt: string;
}

export interface AddUserNoteInput {
  content: string;
  folder?: string;
  tagColor?: NoteTagColor;
}

type UserNoteStore = Record<string, UserNoteRecord[]>;

let _cache: UserNoteStore | null = null;

function loadStore(): UserNoteStore {
  if (_cache) return _cache;
  try {
    const raw = Taro.getStorageSync(USER_NOTES_STORAGE_KEY);
    _cache = raw && typeof raw === 'object' ? (raw as UserNoteStore) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function persistStore(): void {
  try {
    Taro.setStorageSync(USER_NOTES_STORAGE_KEY, _cache || {});
  } catch {
    /* 静默 */
  }
}

function createNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getUserNotes(userId: string): UserNoteRecord[] {
  if (!userId) return [];
  const list = loadStore()[userId] || [];
  return list.filter((item) => item.content.trim());
}

export function addUserNote(userId: string, input: AddUserNoteInput): UserNoteRecord {
  const store = loadStore();
  const now = new Date().toISOString();
  const record: UserNoteRecord = {
    id: createNoteId(),
    userId,
    content: input.content.trim(),
    folder: input.folder?.trim() || '收件箱',
    tagColor: input.tagColor || 'default',
    createdAt: now,
    updatedAt: now,
  };
  const list = store[userId] || [];
  store[userId] = [record, ...list];
  persistStore();
  return record;
}

export function getUserNoteById(userId: string, noteId: string): UserNoteRecord | null {
  if (!userId || !noteId) return null;
  return getUserNotes(userId).find((item) => item.id === noteId) || null;
}

export function updateUserNote(
  userId: string,
  noteId: string,
  input: Partial<Pick<UserNoteRecord, 'content' | 'folder' | 'tagColor'>>,
): UserNoteRecord | null {
  if (!userId || !noteId) return null;
  const store = loadStore();
  const list = store[userId] || [];
  const index = list.findIndex((item) => item.id === noteId);
  if (index < 0) return null;

  const current = list[index];
  const next: UserNoteRecord = {
    ...current,
    content: input.content !== undefined ? input.content.trim() : current.content,
    folder: input.folder?.trim() || current.folder,
    tagColor: input.tagColor || current.tagColor,
    updatedAt: new Date().toISOString(),
  };
  list[index] = next;
  store[userId] = list;
  persistStore();
  return next;
}

export function removeUserNote(userId: string, noteId: string): boolean {
  if (!userId) return false;
  const store = loadStore();
  const list = store[userId] || [];
  const next = list.filter((item) => item.id !== noteId);
  if (next.length === list.length) return false;
  store[userId] = next;
  persistStore();
  return true;
}

/** 按日期分组（今天 / 昨天 / 更早） */
export function groupNotesByDate(notes: UserNoteRecord[]): { label: string; dateKey: string; items: UserNoteRecord[] }[] {
  const map = new Map<string, UserNoteRecord[]>();
  for (const note of notes) {
    const key = dayjs(note.createdAt).format('YYYY-MM-DD');
    const bucket = map.get(key) || [];
    bucket.push(note);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([dateKey, items]) => {
      const d = dayjs(dateKey);
      const today = dayjs().startOf('day');
      const diff = today.diff(d.startOf('day'), 'day');
      let label = d.format('YYYY-MM-DD');
      if (diff === 0) label = `今天 ${d.format('YYYY-MM-DD')}`;
      else if (diff === 1) label = `昨天 ${d.format('YYYY-MM-DD')}`;
      return { label, dateKey, items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    });
}

export function countNoteChars(content: string): number {
  return content.replace(/\s/g, '').length;
}

export function __resetUserNotesForTest(): void {
  _cache = {};
}
