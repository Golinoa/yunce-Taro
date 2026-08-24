/**
 * 待办四象限（艾森豪威尔矩阵）
 *
 * q1 重要且紧急 · q2 重要不紧急 · q3 紧急不重要 · q4 不紧急不重要
 */
export type TodoQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export interface TodoQuadrantMeta {
  label: string;
  shortLabel: string;
}

export const TODO_QUADRANT_META: Record<TodoQuadrant, TodoQuadrantMeta> = {
  q1: { label: '重要且紧急', shortLabel: '急重' },
  q2: { label: '重要不紧急', shortLabel: '重缓' },
  q3: { label: '紧急不重要', shortLabel: '急轻' },
  q4: { label: '不紧急不重要', shortLabel: '轻缓' },
};

export const TODO_QUADRANT_ORDER: TodoQuadrant[] = ['q1', 'q2', 'q3', 'q4'];

/** 旧 tagColor / level 兜底映射到四象限 */
export function resolveTodoQuadrant(input: {
  quadrant?: TodoQuadrant;
  level?: 'urgent' | 'high' | 'normal' | 'low';
}): TodoQuadrant {
  if (input.quadrant) return input.quadrant;
  if (input.level === 'urgent') return 'q1';
  if (input.level === 'high') return 'q2';
  if (input.level === 'normal') return 'q3';
  return 'q4';
}
