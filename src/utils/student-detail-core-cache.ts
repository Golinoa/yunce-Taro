/**
 * 学员详情「首屏核心数据」缓存（student + parents）
 *
 * 为什么需要：小程序每次 navigateTo 进详情页都是全新页面实例、state 全丢 ⇒ 每次点开都要等
 * 网络才渲染，表现为「每次点击都出现全屏 loading」。有缓存后可同步渲染、不出现 loading，
 * 再由后台静默刷新替换最新数据（stale-while-revalidate）。
 *
 * 护栏：
 * - 作用域沿用 cache-store 的四维隔离（机构/用户/角色/校区）⇒ 不串租户；切机构/身份/登出时
 *   由 reset-domain-caches 的 clearAllCache 整体清空；
 * - 有效期 5 分钟（TTL.list 同量级）：即使某次写后失效没走到，旧值最多活 5 分钟且进页即刷新；
 * - 写操作失效：写操作会置 `REFRESH_SIGNAL.students`（编辑学员 / 录入课时 / 退费 / 转校等 6 处），
 *   该键未清除期间读缓存直接判 miss（见 hasPendingStudentWrite），避免先闪旧值。
 */
import Taro from '@tarojs/taro';
import type { Student, StudentParent } from '@/types/student';
import { getCacheScope } from '@/utils/cache-scope';
import { getCache, invalidateCache, setCache } from '@/utils/cache-store';
import { TTL } from '@/utils/data-freshness';
import { REFRESH_SIGNAL } from '@/utils/refresh-signal';

export const STUDENT_DETAIL_CORE_DOMAIN = 'student-detail-core';

export interface StudentDetailCoreCache {
  student: Student;
  parents: StudentParent[];
}

/**
 * 是否存在「学员数据已变更」的待刷新信号。
 * 写操作（编辑学员 / 录入课时 / 退费 / 转校，6 处均走 `REFRESH_SIGNAL.students`）会置该键，
 * 由消费页（学员列表 / 详情页 useDidShow）读取后清除；只要它还挂着，就说明本地已有缓存
 * 可能过期 ⇒ 首屏不直接用它，避免闪一下旧数据。
 */
function hasPendingStudentWrite(): boolean {
  try {
    return Boolean(Taro.getStorageSync(REFRESH_SIGNAL.students));
  } catch {
    return false;
  }
}

/** 同步读；未命中 / 已过期 / 开关关闭 / 有待刷新写操作均返回 null */
export function readStudentDetailCore(studentId: string): StudentDetailCoreCache | null {
  if (!studentId) return null;
  if (hasPendingStudentWrite()) return null;
  const hit = getCache<StudentDetailCoreCache>(
    STUDENT_DETAIL_CORE_DOMAIN,
    studentId,
    getCacheScope(),
    TTL.list,
  );
  if (!hit || !hit.student) return null;
  return hit;
}

/** 首屏核心数据回填（fetchCore 成功后调用） */
export function writeStudentDetailCore(studentId: string, data: StudentDetailCoreCache): void {
  if (!studentId || !data.student) return;
  setCache(STUDENT_DETAIL_CORE_DOMAIN, studentId, data, getCacheScope());
}

/** 失效：不传 studentId 则清空当前作用域下整个域 */
export function invalidateStudentDetailCore(studentId?: string): void {
  invalidateCache(STUDENT_DETAIL_CORE_DOMAIN, getCacheScope(), studentId);
}
