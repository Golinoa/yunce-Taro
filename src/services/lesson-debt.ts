/**
 * Service 层 — 欠课记录 API（P1 欠课机制）
 *
 * 后端接口尚未提供，真实环境返回空/抛错，避免假数据。
 */
import type { LessonDebt } from '@/types/lesson-debt';

export const lessonDebtService = {
  getPendingByStudent: async (_studentId: string): Promise<LessonDebt[]> => {
    return [];
  },

  getPendingHours: async (_studentId: string): Promise<number> => {
    return 0;
  },

  addDebt: async (_params: {
    studentId: string;
    subjectId?: string;
    subjectName?: string;
    hours: number;
    sourceRecordId?: string;
  }): Promise<LessonDebt> => {
    throw new Error('欠课 API 暂未接通');
  },

  settleByStudent: async (
    _studentId: string,
    _type: 'deduct' | 'waive',
    _maxSettleHours?: number,
  ): Promise<{ settledHours: number; remainingDebtHours: number }> => {
    throw new Error('欠课 API 暂未接通');
  },
};
