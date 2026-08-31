/** 考勤异常 / 续费提醒 */
export type AttendanceAnomalyKind = 'over_attend' | 'long_absent' | 'long_paused';

export interface AttendanceAnomalyItem {
  id: string;
  studentId: string;
  studentName: string;
  nickname?: string;
  avatarUrl?: string;
  kind: AttendanceAnomalyKind;
  kindLabel: string;
  subtitle: string;
  campusId?: string;
}

export interface RenewalReminderItem {
  id: string;
  studentId: string;
  studentName: string;
  nickname?: string;
  avatarUrl?: string;
  remainingHours: number;
  remainingDays: number | null;
  remainingAmount: number;
  reasons: string[];
  muted: boolean;
}
