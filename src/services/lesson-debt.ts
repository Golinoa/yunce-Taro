/**
 * Service 层 — 欠课记录 API（P1 欠课机制）
 *
 * 页面只读本服务：签到课时不足时记欠课、发卡/充值时查询并结算欠课（划扣/平账）。
 */
import {
  addDebt,
  getPendingDebtHours,
  getPendingDebtsByStudent,
  settleDebts,
} from '@/data/lesson-debt';
import type { LessonDebt } from '@/types/lesson-debt';
import { notWired } from '@/utils/not-wired';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const lessonDebtService = {
  /** 查某学员未结清欠课（同步） */
  getPendingByStudent: (studentId: string): LessonDebt[] => {
    if (!USE_MOCK) notWired('lessonDebt.getPendingByStudent');
    return getPendingDebtsByStudent(studentId);
  },

  /** 查某学员未结欠课合计课时（同步） */
  getPendingHours: (studentId: string): number => {
    if (!USE_MOCK) notWired('lessonDebt.getPendingHours');
    return getPendingDebtHours(studentId);
  },

  /** 记一笔欠课（欠课上课） */
  addDebt: async (params: {
    studentId: string;
    subjectId?: string;
    subjectName?: string;
    hours: number;
    sourceRecordId?: string;
  }): Promise<LessonDebt> => {
    if (!USE_MOCK) notWired('lessonDebt.addDebt');
    return addDebt(params);
  },

  /** 结算某学员欠课（划扣 deduct / 平账 waive；deduct 可传抵扣额度） */
  settleByStudent: async (
    studentId: string,
    type: 'deduct' | 'waive',
    maxSettleHours?: number,
  ): Promise<{ settledHours: number; remainingDebtHours: number }> => {
    if (!USE_MOCK) notWired('lessonDebt.settleByStudent');
    return settleDebts(studentId, type, maxSettleHours);
  },
};
