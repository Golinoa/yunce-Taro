/**
 * Service 层 — 欠课记录 API（P1 欠课机制）
 *
 * 后端接口尚未提供，真实环境暂回落 mock 内存数据，避免联调阻断主流程。
 */
import type { LessonDebt } from '@/types/lesson-debt';
import { loadLessonDebtMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

export const lessonDebtService = {
  getPendingByStudent: async (studentId: string): Promise<LessonDebt[]> => {
    if (!isUseMock()) return [];
    const { getPendingDebtsByStudent } = await loadLessonDebtMock();
    return getPendingDebtsByStudent(studentId);
  },

  getPendingHours: async (studentId: string): Promise<number> => {
    if (!isUseMock()) return 0;
    const { getPendingDebtHours } = await loadLessonDebtMock();
    return getPendingDebtHours(studentId);
  },

  addDebt: async (params: {
    studentId: string;
    subjectId?: string;
    subjectName?: string;
    hours: number;
    sourceRecordId?: string;
  }): Promise<LessonDebt> => {
    if (!isUseMock()) throw new Error('欠课 API 暂未接通');
    const { addDebt } = await loadLessonDebtMock();
    return addDebt(params);
  },

  settleByStudent: async (
    studentId: string,
    type: 'deduct' | 'waive',
    maxSettleHours?: number,
  ): Promise<{ settledHours: number; remainingDebtHours: number }> => {
    if (!isUseMock()) throw new Error('欠课 API 暂未接通');
    const { settleDebts } = await loadLessonDebtMock();
    return settleDebts(studentId, type, maxSettleHours);
  },
};
