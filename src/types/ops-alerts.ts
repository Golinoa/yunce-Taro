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
  /** 在用卡类别：`count` 次卡 / `stored` 储值卡（决定显示课时还是余额） */
  cardKinds: string[];
  remainingHours: number;
  remainingDays: number | null;
  remainingAmount: number;
  reasons: string[];
  muted: boolean;
}
