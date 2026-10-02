/**
 * 单学员出勤落库（补录 / 增量编辑共用）
 */
import { lessonRecordService, notificationService } from '@/services';
import type { Subject } from '@/types/campus';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import {
  resolveLessonDeduction,
  resolveRemainingAfterDeduct,
} from '@/utils/lesson-deduction-source';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import type { CheckinStatus } from './checkin-status';

export type PersistAttendanceContext = {
  student: Student;
  status: CheckinStatus;
  isSupplement?: boolean;
  existingRecord?: LessonRecord;
  lessonDate: string;
  /** 本节排课规则 ID：写入记录后用于区分「同班同一天的另一节课」 */
  scheduleId?: string;
  hoursUsed: number;
  selectedClassId?: string | null;
  selectedTeachingTeacherId?: string;
  currentTeacherId?: string;
  selectedAssistantTeacherId?: string;
  campusId?: string;
  room?: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  studentPackages: Map<string, CoursePackage>;
  /** 学员会员卡（新账本，含卡种科目）：旧课包优先，没有才用它扣减 */
  studentMemberCards?: Map<string, MemberCardDetail[]>;
  studentSubjects: Map<string, Subject | null>;
  studentRemarkDrafts: Record<string, string>;
  makeupStudentIds: Set<string>;
  senderId: string;
};

export async function persistStudentAttendanceRecord(ctx: PersistAttendanceContext): Promise<void> {
  const { student, status } = ctx;
  if (ctx.existingRecord) {
    await lessonRecordService.remove(ctx.existingRecord.id);
  }

  const basePayload = {
    teacher_id: ctx.selectedTeachingTeacherId || ctx.currentTeacherId || '',
    operator_teacher_id: ctx.currentTeacherId || ctx.selectedTeachingTeacherId,
    assistant_teacher_id: ctx.selectedAssistantTeacherId || undefined,
    student_id: student.id,
    class_id: ctx.selectedClassId || undefined,
    schedule_id: ctx.scheduleId || undefined,
    lesson_date: ctx.lessonDate,
    campus_id: ctx.campusId || undefined,
    room: ctx.room || undefined,
  };

  if (status === 'checked') {
    const cards = ctx.studentMemberCards?.get(student.id) ?? [];
    const studentSubject = ctx.studentSubjects.get(student.id);
    // 扣哪张卡（唯一口径见 utils/lesson-deduction-source；课包已移除）
    const deduction = resolveLessonDeduction({
      memberCards: cards,
      hoursNeeded: ctx.hoursUsed,
      subject: studentSubject ? { id: studentSubject.id, name: studentSubject.name } : undefined,
    });
    if (!deduction) {
      throw new Error(`${student.name}：无可扣课时（会员卡）`);
    }
    const memberCard = cards.find((item) => item.id === deduction.id);
    const isCrossSubject =
      !!memberCard?.cardTypeSubjectId &&
      !!studentSubject &&
      memberCard.cardTypeSubjectId !== studentSubject.id;

    const createdRecord = await lessonRecordService.create({
      ...basePayload,
      package_id: '',
      member_card_id: deduction.id,
      hours_used: ctx.hoursUsed,
      status: ctx.isSupplement || ctx.makeupStudentIds.has(student.id) ? 'makeup' : 'normal',
      is_cross_subject: isCrossSubject || undefined,
      package_subject: isCrossSubject ? deduction.name : undefined,
      class_subject: isCrossSubject ? studentSubject?.name : undefined,
      content: ctx.isSupplement ? '补录签到' : ctx.content.trim() || undefined,
      note: ctx.studentRemarkDrafts[student.id] || ctx.existingRecord?.note || undefined,
      performance: ctx.performance > 0 ? `${ctx.performance}星` : undefined,
      homework: ctx.homework.trim() || undefined,
      homework_images: ctx.homeworkImages.length > 0 ? ctx.homeworkImages : undefined,
    });

    await notifyStudentParentsSafe({
      studentId: student.id,
      senderId: ctx.senderId,
      title: ctx.isSupplement ? `${student.name} 已补录签到` : `${student.name} 课时已核销`,
      /**
       * ⚠️ 剩余课时以**后端返回的 `remaining_hours` 为准**；拿不到时才本地推算，
       * 而且必须按"这一笔实际扣的是哪本账"来算（课包用课包余额，会员卡用卡余额）。
       */
      content: ctx.isSupplement
        ? `${ctx.lessonDate} 已补录 ${ctx.hoursUsed} 课时，剩余 ${resolveRemainingAfterDeduct(
            createdRecord.remaining_hours,
            memberCard,
            ctx.hoursUsed,
          )} 课时`
        : `本次核销 ${ctx.hoursUsed} 课时，剩余 ${resolveRemainingAfterDeduct(
            createdRecord.remaining_hours,
            memberCard,
            ctx.hoursUsed,
          )} 课时`,
      logLabel: 'lesson-form notify parents after checkin',
    });
    return;
  }

  if (status === 'leave') {
    await lessonRecordService.create({
      ...basePayload,
      package_id: '',
      hours_used: 0,
      status: 'leave',
      content: ctx.isSupplement ? '补录请假' : '家长已请假，本节课自动记为请假',
      note: ctx.studentRemarkDrafts[student.id] || ctx.existingRecord?.note || undefined,
    });
    return;
  }

  await lessonRecordService.create({
    ...basePayload,
    package_id: '',
    hours_used: ctx.hoursUsed,
    status: 'absent',
    create_debt: true,
    content: ctx.isSupplement ? '补录未到' : '点名未到，待老师后续补录签到',
    note: ctx.studentRemarkDrafts[student.id] || ctx.existingRecord?.note || undefined,
  });
}

/** 跨科目提醒（班级点名路径）；失败由调用方捕获 */
export async function notifyCrossSubjectIfNeeded(input: {
  senderId: string;
  student: Student;
  /**
   * 扣减来源的名称（课包名或会员卡名）。
   * ⚠️ 不再收 `pkg: CoursePackage`：扣减来源可能是会员卡，那时根本没有课包对象。
   */
  sourceName: string;
  studentSubject?: Subject | null;
  hoursUsed: number;
  isCrossSubject: boolean;
}): Promise<void> {
  if (!input.isCrossSubject) return;
  await notificationService.send({
    sender_id: input.senderId,
    receiver_id: 'principal',
    title: '跨科目消课提醒',
    content: `${input.student.name} 使用「${input.sourceName}」消课 ${input.hoursUsed} 课时（班级科目：${input.studentSubject?.name || '通用'}）`,
    related_id: input.student.id,
  });
}
