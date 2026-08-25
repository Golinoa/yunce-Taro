/**
 * 待办四象限（艾森豪威尔矩阵）
 *
 * q1 重要且紧急 · q2 重要不紧急 · q3 紧急不重要 · q4 不紧急不重要
 *
 * 优先级排序（高 → 低）：q1 > q2 > q3 > q4
 */
export type TodoQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export interface TodoQuadrantMeta {
  /** 完整文案（创建弹层、看板标题等） */
  label: string;
  /**
   * 筛选条短标签（「我的待办」等空间受限场景）。
   *
   * 设计理念（口语化优先级名，对应完整象限）：
   * - 紧急 → q1 重要且紧急（又重要又赶，立刻处理）
   * - 重要 → q2 重要不紧急（重要但可规划，优先投入）
   * - 优先 → q3 紧急不重要（赶但不重，可委派/穿插）
   * - 普通 → q4 不紧急不重要（可暂缓或精简）
   */
  shortLabel: string;
}

export const TODO_QUADRANT_META: Record<TodoQuadrant, TodoQuadrantMeta> = {
  q1: { label: '重要且紧急', shortLabel: '紧急' },
  q2: { label: '重要不紧急', shortLabel: '重要' },
  q3: { label: '紧急不重要', shortLabel: '优先' },
  q4: { label: '不紧急不重要', shortLabel: '普通' },
};

export const TODO_QUADRANT_ORDER: TodoQuadrant[] = ['q1', 'q2', 'q3', 'q4'];

/** 优先级排序权重：数值越小优先级越高 */
export const TODO_QUADRANT_PRIORITY_RANK: Record<TodoQuadrant, number> = {
  q1: 0,
  q2: 1,
  q3: 2,
  q4: 3,
};

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
