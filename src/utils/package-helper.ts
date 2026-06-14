/**
 * 课包选择工具函数
 */
import type { CoursePackage } from '@/types/course-package';

/**
 * 从多个课包中选择最优课包
 * 优先级：科目匹配+余额充足 > 通用课包+余额充足 > 任意有余额 > 第一个（欠课）
 */
export function pickBestPackage(
  packages: CoursePackage[],
  hoursNeeded: number,
  subjectId?: string,
): CoursePackage | null {
  if (packages.length === 0) return null;

  // 优先级1：科目匹配 + 余额充足
  if (subjectId) {
    const match = packages.find(
      (p) => p.subject_id === subjectId && p.remaining_hours >= hoursNeeded,
    );
    if (match) return match;
  }

  // 优先级2：通用课包 + 余额充足
  const general = packages.find((p) => !p.subject_id && p.remaining_hours >= hoursNeeded);
  if (general) return general;

  // 优先级3：任意有余额课包
  const any = packages.find((p) => p.remaining_hours >= hoursNeeded);
  if (any) return any;

  // 优先级4：第一个课包（欠课状态）
  return packages[0];
}
