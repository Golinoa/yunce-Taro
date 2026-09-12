/** Service 层 — 欠课记录 API（对接 /lesson-debts） */
import type { LessonDebt } from '@/types/lesson-debt';
import { formatApiDateTime } from '@/utils/pagination';
import { get, post } from '@/utils/request';

type BackendDebt = Record<string, unknown>;

function mapDebt(raw: BackendDebt): LessonDebt {
  return {
    id: String(raw.id ?? ''),
    studentId: String(raw.studentId ?? ''),
    subjectId: raw.subjectId == null ? undefined : String(raw.subjectId),
    subjectName: raw.subjectName == null ? undefined : String(raw.subjectName),
    hours: Number(raw.hours ?? 0),
    sourceRecordId: raw.sourceRecordId == null ? undefined : String(raw.sourceRecordId),
    createdAt: formatApiDateTime(raw.createdAt) || String(raw.createdAt ?? ''),
    status: (raw.status as LessonDebt['status']) || 'pending',
    settledType: raw.settledType as LessonDebt['settledType'],
    settledAt:
      raw.settledAt == null ? undefined : formatApiDateTime(raw.settledAt) || String(raw.settledAt),
  };
}

export const lessonDebtService = {
  getPendingByStudent: async (studentId: string): Promise<LessonDebt[]> => {
    const data = await get<BackendDebt[] | { list?: BackendDebt[] }>(
      `/lesson-debts/students/${studentId}/pending`,
    );
    const list = Array.isArray(data) ? data : data?.list || [];
    return list.map(mapDebt);
  },

  getPendingHours: async (studentId: string): Promise<number> => {
    const data = await get<{ hours?: number }>(`/lesson-debts/students/${studentId}/pending-hours`);
    return Number(data?.hours ?? 0);
  },

  addDebt: async (params: {
    studentId: string;
    subjectId?: string;
    subjectName?: string;
    hours: number;
    sourceRecordId?: string;
  }): Promise<LessonDebt> => {
    const raw = await post<BackendDebt>('/lesson-debts', params);
    return mapDebt(raw);
  },

  settleByStudent: async (
    studentId: string,
    type: 'deduct' | 'waive',
    maxSettleHours?: number,
    memberCardId?: string,
  ): Promise<{
    settledHours: number;
    remainingDebtHours: number;
    notCovered: number;
  }> => {
    const data = await post<{
      settledHours?: number;
      remainingDebtHours?: number;
      notCovered?: number;
    }>(`/lesson-debts/students/${studentId}/settle`, {
      type,
      ...(maxSettleHours != null ? { maxSettleHours } : {}),
      ...(memberCardId ? { memberCardId } : {}),
    });
    return {
      settledHours: Number(data?.settledHours ?? 0),
      remainingDebtHours: Number(data?.remainingDebtHours ?? 0),
      notCovered: Number(data?.notCovered ?? 0),
    };
  },
};
