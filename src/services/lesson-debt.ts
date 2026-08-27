/**
 * Service 层 — 欠课记录 API（P1 欠课机制）
 *
 * 后端接口尚未提供，真实环境暂回落 mock 内存数据，避免联调阻断主流程。
 */
import {
  addDebt,
  getPendingDebtHours,
  getPendingDebtsByStudent,
  settleDebts,
} from '@/data/lesson-debt';
import type { LessonDebt } from '@/types/lesson-debt';

export const lessonDebtService = {
  getPendingByStudent: (studentId: string): LessonDebt[] => {
    return getPendingDebtsByStudent(studentId);
  },

  getPendingHours: (studentId: string): number => {
    return getPendingDebtHours(studentId);
  },

  addDebt: async (params: {
    studentId: string;
    subjectId?: string;
    subjectName?: string;
    hours: number;
    sourceRecordId?: string;
  }): Promise<LessonDebt> => {
    return addDebt(params);
  },

  settleByStudent: async (
    studentId: string,
    type: 'deduct' | 'waive',
    maxSettleHours?: number,
  ): Promise<{ settledHours: number; remainingDebtHours: number }> => {
    return settleDebts(studentId, type, maxSettleHours);
  },
};
