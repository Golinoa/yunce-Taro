/**
 * 笔记提醒 → 首页待办时间轴
 */
import dayjs from 'dayjs';
import type { TodoItem } from '@/types/home-todo';
import type { UserNoteRecord } from '@/utils/user-notes';

export const NOTE_TODO_ID_PREFIX = 'note-remind-';

export function isNoteTodoId(todoId: string): boolean {
  return todoId.startsWith(NOTE_TODO_ID_PREFIX);
}

export function noteTodoId(noteId: string): string {
  return `${NOTE_TODO_ID_PREFIX}${noteId}`;
}

export function extractNoteIdFromTodoId(todoId: string): string {
  return todoId.slice(NOTE_TODO_ID_PREFIX.length);
}

/** 带提醒的笔记转为时间轴条目 */
export function mapNoteToHomeItem(note: UserNoteRecord, userName?: string): TodoItem | null {
  if (!note.remindEnabled || !note.remindDate) return null;

  const timePart = note.remindTime || '09:00';
  const remindAt = dayjs(`${note.remindDate} ${timePart}`).toISOString();
  const isCompleted = Boolean(note.completedAt);
  const title = note.content.trim().split('\n')[0]?.slice(0, 40) || '笔记提醒';

  return {
    id: noteTodoId(note.id),
    title,
    desc: note.content.length > 40 ? `${note.content.slice(0, 60)}…` : note.content,
    note: note.content,
    remindAt,
    remindEnabled: true,
    level: 'low',
    quadrant: 'q4',
    category: 'custom',
    actionLabel: '完成',
    sourceType: 'note',
    sharedScope: 'private',
    displayDay: note.remindDate,
    completed: isCompleted,
    completion: isCompleted
      ? {
          completedAt: note.completedAt!,
          completedBy: note.userId,
          completedByName: userName || '我',
          note: note.completionNote,
        }
      : undefined,
  };
}
