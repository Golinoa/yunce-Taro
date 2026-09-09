/** Service 层 — 欠课记录 API（后端契约尚未提供）。 */
import type { LessonDebt } from '@/types/lesson-debt';

export const lessonDebtService = {
  getPendingByStudent: async (_studentId: string): Promise<LessonDebt[]> => {
    throw new Error('[接口未接通] lesson-debt 后端尚未提供欠课查询接口');
  },

  getPendingHours: async (_studentId: string): Promise<number> => {
    throw new Error('[接口未接通] lesson-debt 后端尚未提供欠课累计接口');
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
