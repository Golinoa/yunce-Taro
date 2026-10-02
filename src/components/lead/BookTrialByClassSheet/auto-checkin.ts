/**
 * 「添加即签到」编排（2026-10-01 用户口径）
 *
 * 期望流程：弹层里选好学员 → 二次确认（提示将自动签到）→ 确定后**添加并且签到** → 返回课表；
 * 不再让老师手动进详情页点签到。**补课与试听共用这一套流程**，差别只有扣减口径：
 * - 补课：扣学员自己的课包/会员卡（1 课时），复用点名页同一条链路 `executeSingleDeduct`；
 * - 试听：**不消课时**（无课包、0 课时、状态 NORMAL），与班级点名的「试听签到」完全同口径。
 *
 * ⚠️ 本模块**只做编排，不复制消课口径**：
 * - 「是否已签到」复用唯一真源 `isRecordOfLesson` + 同一组「已消课状态」，
 *   与班级点名的重复保护同口径 ⇒ **幂等**：同一学员、同一节课重复执行不会重复消课（资损红线）。
 * - 「老师是谁」不由前端决定：`LessonRecord.teacherId` 后端按「校长代点名归学员老师 / 否则归操作人」
 *   自行推导，客户端上报的 teacher_id 后端不采信（`lesson-record.service.ts` 只读 operatorTeacherId）。
 */
import { executeSingleDeduct } from '@/package-course/pages/lesson-form/lesson-submit-single';
import { lessonRecordService, memberCardService, packageService } from '@/services';
import { useStudentStore } from '@/stores';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { pickMemberCardForLesson } from '@/utils/lesson-deduction-source';
import { isRecordOfLesson } from '@/utils/lesson-identity';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import { createSubmitLock } from '@/utils/submit-lock';

/** 记签到记录时视为「已消课」的状态（与班级点名口径一致） */
const CONSUMING_STATUSES = new Set(['normal', 'makeup']);

export interface LessonCheckInScope {
  /** 学员 id（补课学员 = Student.id；试听学员 = Lead.trial_student_id） */
  studentId: string;
  classId: string;
  lessonDate: string;
  /** 本节排课编号（课表卡片的 id）；有它才能区分同班同一天的另一节课 */
  scheduleId?: string;
}

export interface AutoCheckInResult {
  ok: boolean;
  /** 该学员本节已有消课记录 ⇒ 没有重复消课，直接算成功 */
  alreadyCheckedIn?: boolean;
  /** 失败原因（给老师看的一句人话） */
  reason?: string;
}

/**
 * 该学员在这节课是否已经有「已消课」记录。
 *
 * 查询失败会**抛出**（不能用"查不到"当作"没签到"，否则会重复消课）；
 * 由调用方决定是拦下还是提示，见两个 `autoCheckIn*` 的兜底。
 */
export async function hasCheckedInLesson(scope: LessonCheckInScope): Promise<boolean> {
  const records = await lessonRecordService.getByStudent(scope.studentId);
  return Boolean(findCheckedInRecord(records, scope));
}

function findCheckedInRecord(
  records: LessonRecord[],
  scope: LessonCheckInScope,
): LessonRecord | undefined {
  return records.find(
    (record) =>
      CONSUMING_STATUSES.has(record.status || 'normal') &&
      isRecordOfLesson(record, {
        classId: scope.classId,
        lessonDate: scope.lessonDate,
        scheduleId: scope.scheduleId,
      }),
  );
}

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

export async function autoCheckInMakeupStudent(
  params: AutoCheckInParams,
): Promise<AutoCheckInResult> {
  const hoursUsed = params.hoursUsed ?? 1;
  const scope: LessonCheckInScope = {
    studentId: params.student.id,
    classId: params.classId,
    lessonDate: params.lessonDate,
    scheduleId: params.scheduleId,
  };

  // ① 已签到就不重复消课（与班级点名的重复保护同一口径）
  try {
    if (await hasCheckedInLesson(scope)) {
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
  /**
   * 没有可用旧课包 ⇒ 兜底找会员卡（新账本）。
   * 只有会员卡的学员此前会直接报"没有可用课包"，签到走不下去。
   */
  let matchedMemberCard: MemberCardDetail | null = null;
  if (!matchedPackage) {
    try {
      const cards = await memberCardService.getByStudent(params.student.id);
      matchedMemberCard = pickMemberCardForLesson(cards, hoursUsed);
    } catch (err) {
      logError('autoCheckInMakeupStudent load member cards', err);
      return { ok: false, reason: '读取课时来源失败，请进点名页手动签到' };
    }
  }
  if (!matchedPackage && !matchedMemberCard) {
    return { ok: false, reason: `${params.student.name} 没有可用课时，无法签到` };
  }

  // ③ 复用点名页的单人消课链路（自动签到记 makeup，与班级点名口径一致）
  let succeeded = false;
  let failureReason = '';
  await executeSingleDeduct({
    selectedStudent: params.student,
    matchedPackage,
    matchedMemberCard,
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

export interface AutoCheckInTrialParams extends LessonCheckInScope {
  /** 试听线索名（仅用于失败提示） */
  studentName?: string;
  /** 当前老师的身份 id（写记录的兜底值；老师归属后端自己推导） */
  currentTeacherId?: string;
}

/**
 * 试听学员签到：**不消课时**。
 *
 * 与班级点名里「试听学员签到」逐字同口径（`lesson-submit-class.ts` 的 `presentTrialBookings`）：
 * 无课包、`hoursUsed = 0`、状态 NORMAL、内容「试听签到」。
 * 不做课包挑选、不做家长通知、不写欠课 —— 试听本来就没有课时可扣。
 */
export async function autoCheckInTrialStudent(
  params: AutoCheckInTrialParams,
): Promise<AutoCheckInResult> {
  const scope: LessonCheckInScope = {
    studentId: params.studentId,
    classId: params.classId,
    lessonDate: params.lessonDate,
    scheduleId: params.scheduleId,
  };

  // ① 幂等：该学员本节已签到就不重复写记录
  try {
    if (await hasCheckedInLesson(scope)) {
      return { ok: true, alreadyCheckedIn: true };
    }
  } catch (err) {
    logError('autoCheckInTrialStudent existing records', err);
    return { ok: false, reason: '无法确认本节课签到状态，请进点名页手动签到' };
  }

  // ② 写试听签到记录（无课包 / 0 课时）
  try {
    await lessonRecordService.create({
      teacher_id: params.currentTeacherId || '',
      operator_teacher_id: params.currentTeacherId,
      student_id: params.studentId,
      package_id: '',
      hours_used: 0,
      status: 'normal',
      class_id: params.classId,
      schedule_id: params.scheduleId,
      lesson_date: params.lessonDate,
      content: '试听签到',
    });
  } catch (err) {
    logError('autoCheckInTrialStudent create', err);
    const message = err instanceof Error && err.message ? err.message : '';
    return { ok: false, reason: message || '签到失败，请进点名页手动签到' };
  }

  return { ok: true };
}
