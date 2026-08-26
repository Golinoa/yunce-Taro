/**
 * 待办卡片展示元数据（首页时间轴 / 我的待办列表共用）
 */
import dayjs from 'dayjs';
import type { TodoItem } from '@/types/home-todo';
import { resolveTodoQuadrant, type TodoQuadrant } from '@/types/todo-quadrant';
import { buildRemindMetaFromAt } from '@/utils/custom-todos';
import { resolveTimelineAt } from '@/utils/todo-timeline';

export type TodoCardMetaTone = 'normal' | 'overdue';

export interface TodoCardMeta {
  line: string;
  tone: TodoCardMetaTone;
  isOverdue: boolean;
  /** 是否展示时间行（日历图标 + 提醒/推送时刻） */
  showScheduleRow: boolean;
}

/** 四象限左侧色条（我的待办列表） */
export const TODO_QUADRANT_ACCENT_CLASS: Record<TodoQuadrant, string> = {
  q1: 'bg-destructive',
  q2: 'bg-todo-q2',
  q3: 'bg-todo-q3',
  q4: 'bg-todo-q4',
};

export function hasTodoDisplayTime(item: TodoItem): boolean {
  return Boolean(item.remindAt || item.pushedAt || item.createdAt);
}

/** 卡片内展示提醒时间行（时间轴左侧已有时刻时，仅有提醒的待办在卡片内重复展示） */
export function shouldShowTodoCardScheduleRow(item: TodoItem): boolean {
  return Boolean(item.remindAt);
}

/** ScrollView scroll-into-view 锚点 id */
export function buildTodoCardDomId(todoId: string): string {
  return `todo-card-${todoId}`;
}

/** 构建卡片副文案（提醒/逾期/完成/无提醒） */
export function buildTodoCardMeta(item: TodoItem, now = dayjs()): TodoCardMeta {
  const isDone = Boolean(item.completed || item.completion);

  if (isDone) {
    const at = item.completion?.completedAt;
    return {
      line: at ? `已完成 · ${dayjs(at).format('YYYY-MM-DD HH:mm')}` : '已完成',
      tone: 'normal',
      isOverdue: false,
      showScheduleRow: false,
    };
  }

  if (item.remindEnabled === false && !item.remindAt) {
    if (item.createdAt && dayjs(item.createdAt).isValid()) {
      const timelineAt = dayjs(item.createdAt);
      return {
        line: timelineAt.format('MM/DD HH:mm'),
        tone: 'normal',
        isOverdue: false,
        showScheduleRow: true,
      };
    }
    return {
      line: item.note || item.desc || '无提醒',
      tone: 'normal',
      isOverdue: false,
      showScheduleRow: false,
    };
  }

  if (item.remindAt) {
    const remindMeta = buildRemindMetaFromAt(item.remindAt);
    if (remindMeta) {
      const timelineAt = resolveTimelineAt(item, now);
      return {
        line: remindMeta.isOverdue ? remindMeta.line : timelineAt.format('MM/DD HH:mm'),
        tone: remindMeta.tone,
        isOverdue: remindMeta.isOverdue,
        showScheduleRow: true,
      };
    }
  }

  if (hasTodoDisplayTime(item)) {
    const timelineAt = resolveTimelineAt(item, now);
    return {
      line: timelineAt.format('MM/DD HH:mm'),
      tone: 'normal',
      isOverdue: false,
      showScheduleRow: true,
    };
  }

  return {
    line: item.desc || '',
    tone: 'normal',
    isOverdue: false,
    showScheduleRow: false,
  };
}

/** 我的待办列表左侧色条：逾期优先红色，否则按象限 */
export function resolveTodoCardAccentClass(item: TodoItem): string {
  const isDone = Boolean(item.completed || item.completion);
  const meta = buildTodoCardMeta(item);
  if (!isDone && meta.isOverdue) {
    return 'bg-destructive';
  }
  const quadrant = resolveTodoQuadrant({ quadrant: item.quadrant, level: item.level });
  return TODO_QUADRANT_ACCENT_CLASS[quadrant];
}
