/**
 * 课时状态判断工具
 * 根据剩余课时和课包状态返回对应的卡片状态
 */
import type { StudentCardStatus, StudentProgress, PackageTag } from '@/types/student';

/** 课时预警阈值 */
const HOURS_LOW_THRESHOLD = 5;
/** 即将过期天数阈值 */
const EXPIRING_DAYS_THRESHOLD = 30;

/** 根据剩余课时获取课时数字颜色状态 */
export function getHoursColorStatus(remainingHours: number): 'normal' | 'warn' | 'danger' {
  if (remainingHours > HOURS_LOW_THRESHOLD) return 'normal';
  if (remainingHours >= 1) return 'warn';
  return 'danger';
}

/** 根据剩余课时获取课时数字颜色 */
export function getHoursColor(remainingHours: number): string {
  const status = getHoursColorStatus(remainingHours);
  switch (status) {
    case 'warn':
      return '#d4a24e';
    case 'danger':
      return '#D94040';
    default:
      return '#5EC8A8';
  }
}

/** 计算学员卡片综合状态 */
export function getStudentCardStatus(student: {
  course_packages?: { remaining_hours: number; status?: string; valid_until?: string }[];
  oweCount?: number;
}): StudentCardStatus {
  const packages = student.course_packages || [];

  // 欠课优先
  if (student.oweCount && student.oweCount > 0) return 'owe';

  // 已过期
  if (packages.some((p) => p.status === 'expired')) return 'expired';

  // 即将过期
  if (
    packages.some((p) => {
      if (!p.valid_until) return false;
      const daysLeft = Math.ceil(
        (new Date(p.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return daysLeft > 0 && daysLeft <= EXPIRING_DAYS_THRESHOLD;
    })
  )
    return 'expiring';

  // 课时不足
  if (packages.some((p) => p.remaining_hours >= 1 && p.remaining_hours <= HOURS_LOW_THRESHOLD))
    return 'low';

  return 'sufficient';
}

/** 获取卡片左边框颜色 */
export function getCardBorderColor(status: StudentCardStatus): string {
  switch (status) {
    case 'sufficient':
      return '#5EC8A8';
    case 'low':
      return '#d4a24e';
    case 'expiring':
      return '#6ba3d6';
    case 'expired':
      return '#D94040';
    case 'owe':
      return '#e88aaa';
  }
}

/** 获取进度条渐变样式 */
export function getProgressGradient(status: StudentCardStatus): string {
  switch (status) {
    case 'sufficient':
      return 'linear-gradient(90deg, #5EC8A8, #7dd8bc)';
    case 'low':
      return 'linear-gradient(90deg, #d4a24e, #e8c47a)';
    case 'expiring':
      return 'linear-gradient(90deg, #6ba3d6, #93c5e8)';
    case 'expired':
      return 'linear-gradient(90deg, #D94040, #e87070)';
    case 'owe':
      return 'linear-gradient(90deg, #e88aaa, #f0b3c7)';
  }
}

/** 计算学员总课时进度 */
export function calcStudentProgress(student: {
  course_packages?: { total_hours: number; remaining_hours: number }[];
}): StudentProgress {
  const packages = student.course_packages || [];
  const total = packages.reduce((s, p) => s + p.total_hours, 0);
  const remaining = packages.reduce((s, p) => s + p.remaining_hours, 0);
  const used = total - remaining;
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const status = getHoursColorStatus(remaining);
  return { used, total, percentage, status };
}

/** 生成课包标签列表 */
export function generatePackageTags(student: {
  course_packages?: { name: string; remaining_hours: number; total_hours: number }[];
}): PackageTag[] {
  const packages = student.course_packages || [];
  const colorPool: PackageTag['color'][] = [
    'primary',
    'amber',
    'danger',
    'purple',
    'accent',
    'info',
  ];
  return packages.map((p, i) => ({
    name: p.name,
    remainingHours: p.remaining_hours,
    color: colorPool[i % colorPool.length],
  }));
}

/** 计算统计摘要 */
export function calcStudentSummary(
  students: {
    course_packages?: { remaining_hours: number; status?: string }[];
    oweCount?: number;
  }[],
): { total: number; sufficient: number; low: number; owe: number } {
  let sufficient = 0;
  let low = 0;
  let owe = 0;

  for (const s of students) {
    const status = getStudentCardStatus(s);
    if (status === 'owe') owe++;
    else if (status === 'low' || status === 'expiring' || status === 'expired') low++;
    else sufficient++;
  }

  return { total: students.length, sufficient, low, owe };
}
