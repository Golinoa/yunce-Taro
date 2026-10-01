/**
 * 「补课 + 自动签到」编排（2026-10-01 用户口径）
 *
 * 期望流程：弹层里选好学员 → 二次确认（提示将自动签到）→ 确定后**添加并且签到** → 返回课表；
 * 不再让老师手动进详情页点签到（原来的 `action=supplement` 跳转即为被替换掉的一步）。
 *
 * ⚠️ 本模块**只做编排，不复制消课口径**：
 * - 扣减来源用共享 `pickBestPackage`（与点名页同一个函数）；
 * - 真正的消课写入复用点名页同一条链路 `executeSingleDeduct`
 *   （含课包扣减、家长通知、审计、提交锁）；
 * - 「是否已签到」复用唯一真源 `isRecordOfLesson`，与班级点名的重复保护同口径。
 * ⇒ **幂等**：同一学员、同一节课重复执行不会重复消课（资损红线）。
 */
import { executeSingleDeduct } from '@/package-course/pages/lesson-form/lesson-submit-single';
import { lessonRecordService, packageService } from '@/services';
import { useStudentStore } from '@/stores';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import { isRecordOfLesson } from '@/utils/lesson-identity';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import { createSubmitLock } from '@/utils/submit-lock';

/** 记签到记录时视为「已消课」的状态（与班级点名口径一致） */
const CONSUMING_STATUSES = new Set(['normal', 'makeup']);

export interface AutoCheckInParams {
  student: Student;
  classId: string;
  /** 本节排课编号（课表卡片的 id）；有它才能区分同班同一天的另一节课 */
  scheduleId?: string;
  lessonDate: string;
  campusId?: string;
  /** 课时数：与点名页单人消课的默认值一致（1 课时） */
  hoursUsed?: number;
  /** 当前登录人（User/Profile id）：写记录与通知的发起人 */
  currentUserId: string;
  /** 当前老师的身份 id（仅兜底展示用，**老师归属由后端按这节课配置解析**） */
  currentTeacherId?: string;
  profile?: { id?: string; name?: string; currentContext?: { role?: string } | null } | null;
}

export interface AutoCheckInResult {
  ok: boolean;
  /** 该学员本节已有消课记录 ⇒ 没有重复消课，直接算成功 */
  alreadyCheckedIn?: boolean;
  /** 失败原因（给老师看的一句人话） */
  reason?: string;
}

export async function autoCheckInMakeupStudent(
  params: AutoCheckInParams,
): Promise<AutoCheckInResult> {
  const hoursUsed = params.hoursUsed ?? 1;

  // ① 已签到就不重复消课（与班级点名的重复保护同一口径）
  try {
    const records = await lessonRecordService.getByStudent(params.student.id);
    const existing = records.find(
      (record) =>
        CONSUMING_STATUSES.has(record.status || 'normal') &&
        isRecordOfLesson(record, {
          classId: params.classId,
          lessonDate: params.lessonDate,
          scheduleId: params.scheduleId,
        }),
    );
    if (existing) {
      return { ok: true, alreadyCheckedIn: true };
    }
  } catch (err) {
    // 查不到旧记录不能当"没有"（宁可多问一次后端，也不能重复消课）：这里直接失败返回
    logError('autoCheckInMakeupStudent existing records', err);
    return { ok: false, reason: '无法确认本节课签到状态，请进点名页手动签到' };
  }

  // ② 扣减来源：与点名页共用同一个挑选函数
  let matchedPackage: CoursePackage | null = null;
  try {
    const packages = await packageService.getActiveByStudent(params.student.id);
    matchedPackage = pickBestPackage(packages, hoursUsed);
  } catch (err) {
    logError('autoCheckInMakeupStudent load packages', err);
    return { ok: false, reason: '读取课包失败，请进点名页手动签到' };
  }
  if (!matchedPackage) {
    return { ok: false, reason: `${params.student.name} 没有可用课包，无法签到` };
  }

  // ③ 复用点名页的单人消课链路（自动签到记 makeup，与班级点名口径一致）
  let succeeded = false;
  let failureReason = '';
  await executeSingleDeduct({
    selectedStudent: params.student,
    matchedPackage,
    hoursUsed,
    lessonDate: params.lessonDate,
    scheduleId: params.scheduleId,
    classId: params.classId,
    recordStatus: 'makeup',
    currentUserId: params.currentUserId,
    currentTeacherId: params.currentTeacherId,
    content: '',
    performance: 0,
    homework: '',
    homeworkImages: [],
    campusId: params.campusId,
    profile: params.profile,
    submitLock: createSubmitLock(),
    setSubmitting: () => undefined,
    invalidateStudents: (userId) =>
      useStudentStore.getState().invalidate(userId || params.currentUserId, params.campusId),
    onSuccess: () => {
      succeeded = true;
    },
    onError: (err) => {
      failureReason = err instanceof Error && err.message ? err.message : '签到失败';
    },
  });

  if (!succeeded) {
    return { ok: false, reason: failureReason || '签到失败，请进点名页手动签到' };
  }
  return { ok: true };
}
