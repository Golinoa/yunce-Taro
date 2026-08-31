/**
 * 考勤异常 / 续费提醒 — Mock 数据与聚合
 */
import dayjs from 'dayjs';
import { COURSE_PACKAGES, STUDENTS } from '@/data/mock-database';
import { getAlertThresholdConfig } from '@/utils/alert-config';
import { isRenewalMuted, readRenewalMuteIds } from '@/utils/renewal-mute';

export type AttendanceAnomalyKind = 'over_attend' | 'long_absent' | 'long_paused';

export interface AttendanceAnomalyItem {
  id: string;
  studentId: string;
  studentName: string;
  /** 昵称（展示规范：姓名后 muted） */
  nickname?: string;
  /** 头像 URL；无则 StudentAvatar 品牌兜底 */
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

const LONG_ABSENT_DAYS = 30;
const LONG_PAUSED_DAYS = 30;

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Mock：考勤异常三类 */
export async function mockListAttendanceAnomalies(
  campusId?: string,
): Promise<AttendanceAnomalyItem[]> {
  await delay();
  const list: AttendanceAnomalyItem[] = [];
  const students = STUDENTS.filter((s) => !campusId || s.campusId === campusId);

  students.forEach((s, index) => {
    const pkgs = COURSE_PACKAGES.filter((p) => p.studentId === s.id);
    const remaining =
      pkgs.length > 0
        ? pkgs.reduce((sum, p) => sum + (p.remainingHours || 0), 0)
        : s.remainingHours;

    const overUsed = pkgs.some(
      (p) => p.usedHours > p.purchasedHours + p.bonusHours || p.remainingHours < 0,
    );
    if (overUsed || (remaining <= 0 && index % 7 === 0)) {
      list.push({
        id: `aa-over-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        nickname: s.nickname,
        avatarUrl: s.avatar_url,
        kind: 'over_attend',
        kindLabel: '超上学员',
        subtitle: overUsed ? '课时已超上' : '剩余课时已用尽仍有出勤',
        campusId: s.campusId,
      });
    }

    const absentDays = 20 + (index % 40);
    if (absentDays >= LONG_ABSENT_DAYS) {
      list.push({
        id: `aa-absent-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        nickname: s.nickname,
        avatarUrl: s.avatar_url,
        kind: 'long_absent',
        kindLabel: '长期未上课',
        subtitle: `已 ${absentDays} 天未到课`,
        campusId: s.campusId,
      });
    }

    if (s.status === 'inactive' || index % 11 === 0) {
      list.push({
        id: `aa-paused-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        nickname: s.nickname,
        avatarUrl: s.avatar_url,
        kind: 'long_paused',
        kindLabel: '长期停课',
        subtitle: `停课超过 ${LONG_PAUSED_DAYS} 天`,
        campusId: s.campusId,
      });
    }
  });

  if (!list.some((i) => i.kind === 'over_attend') && students[0]) {
    list.push({
      id: 'aa-over-demo',
      studentId: students[0].id,
      studentName: students[0].name,
      nickname: students[0].nickname,
      avatarUrl: students[0].avatar_url,
      kind: 'over_attend',
      kindLabel: '超上学员',
      subtitle: '已超上 2 课时',
      campusId: students[0].campusId,
    });
  }
  if (!list.some((i) => i.kind === 'long_absent') && students[1]) {
    list.push({
      id: 'aa-absent-demo',
      studentId: students[1].id,
      studentName: students[1].name,
      nickname: students[1].nickname,
      avatarUrl: students[1].avatar_url,
      kind: 'long_absent',
      kindLabel: '长期未上课',
      subtitle: `已 ${LONG_ABSENT_DAYS + 5} 天未到课`,
      campusId: students[1].campusId,
    });
  }
  if (!list.some((i) => i.kind === 'long_paused') && students[2]) {
    list.push({
      id: 'aa-paused-demo',
      studentId: students[2].id,
      studentName: students[2].name,
      nickname: students[2].nickname,
      avatarUrl: students[2].avatar_url,
      kind: 'long_paused',
      kindLabel: '长期停课',
      subtitle: `停课超过 ${LONG_PAUSED_DAYS} 天`,
      campusId: students[2].campusId,
    });
  }

  return list;
}

/** Mock：续费提醒列表 */
export async function mockListRenewalReminders(options?: {
  campusId?: string;
  includeMuted?: boolean;
}): Promise<RenewalReminderItem[]> {
  await delay();
  const { hours, days, amount } = getAlertThresholdConfig();
  const includeMuted = options?.includeMuted ?? false;
  const muteIds = new Set(readRenewalMuteIds());
  const today = dayjs();
  const items: RenewalReminderItem[] = [];

  STUDENTS.filter((s) => !options?.campusId || s.campusId === options.campusId).forEach(
    (s, index) => {
      const pkgs = COURSE_PACKAGES.filter((p) => p.studentId === s.id && p.status === 'active');
      const remainingHours =
        pkgs.length > 0
          ? pkgs.reduce((sum, p) => sum + Math.max(0, p.remainingHours || 0), 0)
          : Math.max(0, s.remainingHours);

      let remainingDays: number | null = null;
      pkgs.forEach((p) => {
        if (!p.expireDate) return;
        const d = dayjs(p.expireDate).diff(today, 'day');
        if (remainingDays === null || d < remainingDays) remainingDays = d;
      });

      const remainingAmount =
        pkgs.length > 0
          ? pkgs.reduce(
              (sum, p) => sum + Math.max(0, p.remainingHours) * (p.pricePerHour || 0),
              0,
            )
          : remainingHours * 50;

      const reasons: string[] = [];
      if (remainingHours <= hours) reasons.push(`剩余课时 ≤ ${hours}`);
      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= days) {
        reasons.push(`剩余天数 ≤ ${days}`);
      }
      if (remainingAmount <= amount) reasons.push(`剩余金额 ≤ ${amount}元`);

      if (reasons.length === 0 && index < 8) {
        if (index % 3 === 0) reasons.push(`剩余课时 ≤ ${hours}`);
        if (index % 3 === 1) reasons.push(`剩余天数 ≤ ${days}`);
        if (index % 3 === 2) reasons.push(`剩余金额 ≤ ${amount}元`);
      }
      if (reasons.length === 0) return;

      const muted = muteIds.has(s.id) || isRenewalMuted(s.id);
      if (muted && !includeMuted) return;

      items.push({
        id: `rr-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        nickname: s.nickname,
        avatarUrl: s.avatar_url,
        remainingHours:
          index < 8 && remainingHours > hours ? Math.min(hours, 4) : remainingHours,
        remainingDays:
          remainingDays ?? (index % 3 === 1 ? Math.min(days, 5) : remainingDays),
        remainingAmount:
          index % 3 === 2 && remainingAmount > amount
            ? Math.min(amount, 180)
            : Math.round(remainingAmount),
        reasons,
        muted,
      });
    },
  );

  return items;
}
