

import type {
  AttendanceAnomalyItem,
  AttendanceAnomalyKind,
  RenewalReminderItem,
} from '@/types/ops-alerts';
import { get, post, del } from '@/utils/request';

export type { AttendanceAnomalyItem, RenewalReminderItem, AttendanceAnomalyKind };

function mapAnomalyItem(raw: Record<string, unknown>): AttendanceAnomalyItem {
  return {
    id: String(raw.id ?? ''),
    studentId: String(raw.studentId ?? raw.student_id ?? ''),
    studentName: String(raw.studentName ?? raw.student_name ?? ''),
    nickname: (raw.nickname as string | undefined) || undefined,
    avatarUrl: (raw.avatarUrl ?? raw.avatar_url ?? raw.avatar) as string | undefined,
    kind: (raw.kind as AttendanceAnomalyKind) || 'long_absent',
    kindLabel: String(raw.kindLabel ?? raw.kind_label ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    campusId: (raw.campusId ?? raw.campus_id) as string | undefined,
  };
}

function mapRenewalItem(raw: Record<string, unknown>): RenewalReminderItem {
  return {
    id: String(raw.id ?? ''),
    studentId: String(raw.studentId ?? raw.student_id ?? ''),
    studentName: String(raw.studentName ?? raw.student_name ?? ''),
    nickname: (raw.nickname as string | undefined) || undefined,
    avatarUrl: (raw.avatarUrl ?? raw.avatar_url ?? raw.avatar) as string | undefined,
    remainingHours: Number(raw.remainingHours ?? raw.remaining_hours ?? 0),
    remainingDays:
      raw.remainingDays === null || raw.remaining_days === null
        ? null
        : Number(raw.remainingDays ?? raw.remaining_days ?? null),
    remainingAmount: Number(raw.remainingAmount ?? raw.remaining_amount ?? 0),
    reasons: Array.isArray(raw.reasons) ? (raw.reasons as string[]) : [],
    muted: Boolean(raw.muted),
  };
}

export const opsAlertService = {
  listAttendanceAnomalies: async (campusId?: string): Promise<AttendanceAnomalyItem[]> => {
    
      const data = await get<Record<string, unknown>[]>('/ops-alerts/attendance-anomalies', {
        campusId,
      });
      return (Array.isArray(data) ? data : []).map(mapAnomalyItem);
      },

  listRenewalReminders: async (params?: {
    campusId?: string;
    includeMuted?: boolean;
  }): Promise<RenewalReminderItem[]> => {
    
      const data = await get<Record<string, unknown>[]>('/ops-alerts/renewal-reminders', params);
      return (Array.isArray(data) ? data : []).map(mapRenewalItem);
      },

  muteRenewal: async (studentId: string, campusId?: string): Promise<void> => {
    await post('/ops-alerts/renewal-mutes', { studentId, campusId });
  },

  unmuteRenewal: async (studentId: string, campusId?: string): Promise<void> => {
    await del(`/ops-alerts/renewal-mutes/${encodeURIComponent(studentId)}`, {
      campusId,
    });
  },
};
