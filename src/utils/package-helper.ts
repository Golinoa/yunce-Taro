/**
 * 课包选择工具函数
 */
import type { CoursePackage } from '@/types/course-package';

type TrialLikePackage = Pick<CoursePackage, 'type' | 'name' | 'note'>;

/**
 * 从多个课包中选择最优课包
 * 优先级：科目匹配+余额充足 > 通用课包+余额充足 > 任意有余额 > 第一个（欠课）
 * 同优先级内按到期日升序排列（最早到期优先消耗，FIFO）
 */
export function pickBestPackage(
  packages: CoursePackage[],
  hoursNeeded: number,
  subjectId?: string,
): CoursePackage | null {
  if (packages.length === 0) return null;

  // 按到期日升序排列（最早到期优先消耗）
  const sorted = [...packages].sort((a, b) => {
    const dateA = a.end_date || a.expiry_date || '9999-12-31';
    const dateB = b.end_date || b.expiry_date || '9999-12-31';
    return dateA.localeCompare(dateB);
  });

  // 优先级1：科目匹配 + 余额充足
  if (subjectId) {
    const match = sorted.find(
      (p) => p.subject_id === subjectId && p.remaining_hours >= hoursNeeded,
    );
    if (match) return match;
  }

  // 优先级2：通用课包 + 余额充足
  const general = sorted.find((p) => !p.subject_id && p.remaining_hours >= hoursNeeded);
  if (general) return general;

  // 优先级3：任意有余额课包
  const any = sorted.find((p) => p.remaining_hours >= hoursNeeded);
  if (any) return any;

  // 优先级4：第一个课包（欠课状态）
  return sorted[0];
}

export function isTrialPackage(pkg?: TrialLikePackage | null): boolean {
  if (!pkg) return false;
  if (pkg.type === 'trial') return true;
  const text = `${pkg.name || ''} ${pkg.note || ''}`;
  return /试听|体验/.test(text);
}

export function hasTrialPackage(
  packages?: Array<TrialLikePackage | null | undefined> | null,
): boolean {
  if (!packages?.length) return false;
  return packages.some((pkg) => isTrialPackage(pkg || null));
}
