/**
 * 课时状态判断工具
 * 根据剩余课时、课包可用性和校区预警阈值返回卡片状态
 */
import type { StudentCardStatus, StudentProgress } from '@/types/student';
import { getAlertThreshold } from '@/utils/alert-config';

/** 即将过期天数阈值 */
const EXPIRING_DAYS_THRESHOLD = 30;

type CardLike = {
  remaining_count: number;
  status?: string;
  expired_at?: string | null;
};

/** 会员卡是否仍可用：进行中且仍有剩余课时、未过有效期 */
function isUsableCard(card: CardLike, now = Date.now()): boolean {
  if (card.status === 'usedUp' || card.status === 'frozen' || card.status === 'inactive') {
    return false;
  }
  if (card.remaining_count <= 0) return false;
  if (card.expired_at) {
    const end = new Date(card.expired_at).getTime();
    if (Number.isFinite(end) && end < now) return false;
  }
  // status 缺省或 active，且有剩余 → 可用
  return card.status === 'active' || !card.status;
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
 * - 红：没有任何可用会员卡（全过期、全耗尽、或无卡）
 * - 黄：有可用卡，但课时 ≤ 校区预警值 / 即将到期 / 已过期卡但仍有其它可用卡时的不足提醒
 * - 正常：有可用卡且未触及预警
 *
 * 透支（owe）：若仍有可用卡 → 黄；若无可用卡 → 红
 *
 * 2026-10-02：口径由「课包」改为**会员卡**（唯一账本），字段名随之为 `member_cards`。
 */
export function getStudentCardStatus(
  student: {
    member_cards?: CardLike[];
    oweCount?: number;
  },
  threshold = getAlertThreshold(),
): StudentCardStatus {
  const cards = student.member_cards || [];
  const usable = cards.filter((card) => isUsableCard(card));

  // 没有任何可用会员卡 → 红
  if (usable.length === 0) {
    return 'expired';
  }

  // 有可用包时：透支不标红，走黄提醒
  if (student.oweCount && student.oweCount > 0) return 'low';

  // 即将到期（可用卡在阈值天数内到期）
  const now = Date.now();
  const soonExpiring = usable.some((card) => {
    if (!card.expired_at) return false;
    const daysLeft = Math.ceil((new Date(card.expired_at).getTime() - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= EXPIRING_DAYS_THRESHOLD;
  });
  if (soonExpiring) return 'expiring';

  // 课时不足：任一可用卡剩余 ≤ 校区预警值
  if (usable.some((card) => card.remaining_count > 0 && card.remaining_count <= threshold)) {
    return 'low';
  }

  return 'sufficient';
}

/**
 * 细**整圈**边框（0.5px 视觉宽度）：
 * - 红：无可用会员卡
 * - 黄：即将到期 / 课时不足（含有可用卡时的透支提醒）
 * - 正常：无边框
 *
 * 宽度说明：项目统一用 rpx（750rpx = 屏幕宽 = 375px），故 **0.5px ≈ 1rpx**。
 *
 * ⚠️ 必须用 uno.config.ts 里的一体化类 `border-status-*`（内部是 `border: 1rpx solid …`，
 * 一次性给全四边的 width/style/color）。任何"只写宽度 + 单独挂 border-solid"的拆写法
 * 都有 CSS 缺陷：`border-solid` 只设置 border-style，而 `border-width` 的 CSS 初始值是
 * `medium`(=3px)，会让**未显式指定宽度的边回退成 3px 粗线**（2026-09-23 FE-17 实测）。
 */
export function getCardBorderColorClass(status: StudentCardStatus): string {
  switch (status) {
    case 'expired':
    case 'owe':
      // owe 仅在无可用卡时才会走到红（有可用卡时 getStudentCardStatus 已映射为 low）
      return 'border-status-danger';
    case 'low':
    case 'expiring':
      return 'border-status-warn';
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

/** 计算学员总课时进度（会员卡口径；课包已整套移除） */
export function calcStudentProgress(student: {
  member_cards?: { total_count: number; remaining_count: number }[];
}): StudentProgress {
  const cards = student.member_cards || [];
  const total = cards.reduce((sum, c) => sum + c.total_count, 0);
  const remaining = cards.reduce((sum, c) => sum + c.remaining_count, 0);
  const used = total - remaining;
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const status = getHoursColorStatus(remaining);
  return { used, total, percentage, status };
}

/** 会员卡标签列表（保留占位：调用方按需渲染） */

/** 计算统计摘要 */
export function calcStudentSummary(
  students: {
    member_cards?: { remaining_count: number; status?: string }[];
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
