/**
 * 课时状态判断工具
 * 根据剩余课时、课包可用性和校区预警阈值返回卡片状态
 */
import type { StudentCardStatus, StudentProgress, PackageTag } from '@/types/student';
import { getAlertThreshold } from '@/utils/alert-config';

/** 即将过期天数阈值 */
const EXPIRING_DAYS_THRESHOLD = 30;

type PackageLike = {
  remaining_hours: number;
  status?: string;
  valid_until?: string;
};

/** 课包是否仍可用：进行中且仍有剩余课时、未过有效期 */
function isUsablePackage(pkg: PackageLike, now = Date.now()): boolean {
  if (pkg.status === 'expired' || pkg.status === 'frozen') return false;
  if (pkg.remaining_hours <= 0) return false;
  if (pkg.valid_until) {
    const end = new Date(pkg.valid_until).getTime();
    if (Number.isFinite(end) && end < now) return false;
  }
  // status 缺省或 active / 其它非过期态，且有剩余 → 可用
  return pkg.status === 'active' || !pkg.status || pkg.status === 'normal';
}

/** 根据剩余课时获取课时数字颜色状态 */
export function getHoursColorStatus(
  remainingHours: number,
  threshold = getAlertThreshold(),
): 'normal' | 'warn' | 'danger' {
  if (remainingHours <= 0) return 'danger';
  if (remainingHours <= threshold) return 'warn';
  return 'normal';
}

/** 根据剩余课时获取课时数字颜色类名 */
export function getHoursColorClass(
  remainingHours: number,
  threshold = getAlertThreshold(),
): string {
  const status = getHoursColorStatus(remainingHours, threshold);
  switch (status) {
    case 'warn':
      return 'text-amber';
    case 'danger':
      return 'text-destructive';
    default:
      return 'text-foreground';
  }
}

/**
 * 学员卡片综合状态（边框口径）：
 * - 红：没有任何可用会员卡/课包（全过期、全耗尽、或无包）
 * - 黄：有可用包，但课时 ≤ 校区预警值 / 即将到期 / 已过期包但仍有其它可用包时的不足提醒
 * - 正常：有可用包且未触及预警
 *
 * 透支（owe）：若仍有可用包 → 黄；若无可用包 → 红
 */
export function getStudentCardStatus(
  student: {
    course_packages?: PackageLike[];
    oweCount?: number;
  },
  threshold = getAlertThreshold(),
): StudentCardStatus {
  const packages = student.course_packages || [];
  const usable = packages.filter((p) => isUsablePackage(p));

  // 没有任何可用课包/会员卡 → 红
  if (usable.length === 0) {
    if (packages.length === 0) return 'expired';
    if (packages.some((p) => p.status === 'expired') || packages.every((p) => p.remaining_hours <= 0)) {
      return 'expired';
    }
    return 'expired';
  }

  // 有可用包时：透支不标红，走黄提醒
  if (student.oweCount && student.oweCount > 0) return 'low';

  // 即将到期（可用包在阈值天数内到期）
  const now = Date.now();
  const soonExpiring = usable.some((p) => {
    if (!p.valid_until) return false;
    const daysLeft = Math.ceil((new Date(p.valid_until).getTime() - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= EXPIRING_DAYS_THRESHOLD;
  });
  if (soonExpiring) return 'expiring';

  // 课时不足：任一可用包剩余 ≤ 校区预警值
  if (usable.some((p) => p.remaining_hours > 0 && p.remaining_hours <= threshold)) {
    return 'low';
  }

  return 'sufficient';
}

/**
 * 细左边框：
 * - 红：无可用课包
 * - 黄：即将到期 / 课时不足（含有可用包时的透支提醒）
 * - 正常：无边框
 */
export function getCardBorderColorClass(status: StudentCardStatus): string {
  switch (status) {
    case 'expired':
    case 'owe':
      // owe 仅在无可用包时才会走到红（有可用包时 getStudentCardStatus 已映射为 low）
      return 'border-l-[3rpx] border-solid border-destructive';
    case 'low':
    case 'expiring':
      return 'border-l-[3rpx] border-solid border-amber';
    default:
      return '';
  }
}

/** 获取进度条渐变类名 */
export function getProgressGradientClass(status: StudentCardStatus): string {
  switch (status) {
    case 'sufficient':
      return 'bg-progress-primary';
    case 'low':
    case 'expiring':
      return 'bg-gradient-amber';
    case 'expired':
    case 'owe':
      return 'bg-kpi-red';
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
    if (status === 'expired' || status === 'owe') owe++;
    else if (status === 'low' || status === 'expiring') low++;
    else sufficient++;
  }

  return { total: students.length, sufficient, low, owe };
}
