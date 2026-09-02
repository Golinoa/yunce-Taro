/**
 * 单学员出勤落库（补录 / 增量编辑共用）
 */
import { lessonRecordService, notificationService } from '@/services';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/campus';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import type { CheckinStatus } from './checkin-status';

export type PersistAttendanceContext = {
  student: Student;
  status: CheckinStatus;
  isSupplement?: boolean;
  existingRecord?: LessonRecord;
  lessonDate: string;
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
  studentSubjects: Map<string, Subject | null>;
  studentRemarkDrafts: Record<string, string>;
  makeupStudentIds: Set<string>;
  senderId: string;
};

export async function persistStudentAttendanceRecord(
  ctx: PersistAttendanceContext,
): Promise<void> {
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
    lesson_date: ctx.lessonDate,
    campus_id: ctx.campusId || undefined,
    room: ctx.room || undefined,
  };

  if (status === 'checked') {
    const pkg = ctx.studentPackages.get(student.id);
    if (!pkg) {
      throw new Error(`${student.name}：无可用课包`);
    }

    const studentSubject = ctx.studentSubjects.get(student.id);
    const isCrossSubject =
      !!pkg.subject_id && !!studentSubject && pkg.subject_id !== studentSubject.id;

    const createdRecord = await lessonRecordService.create({
      ...basePayload,
      package_id: pkg.id,
      hours_used: ctx.hoursUsed,
      status: ctx.isSupplement || ctx.makeupStudentIds.has(student.id) ? 'makeup' : 'normal',
      is_cross_subject: isCrossSubject || undefined,
      package_subject: isCrossSubject ? pkg.name : undefined,
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
      content: ctx.isSupplement
        ? `${ctx.lessonDate} 已补录 ${ctx.hoursUsed} 课时，剩余 ${
            createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - ctx.hoursUsed, 0)
          } 课时`
        : `本次核销 ${ctx.hoursUsed} 课时，剩余 ${
            createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - ctx.hoursUsed, 0)
          } 课时`,
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
    hours_used: 0,
    status: 'absent',
    content: ctx.isSupplement ? '补录未到' : '点名未到，待老师后续补录签到',
    note: ctx.studentRemarkDrafts[student.id] || ctx.existingRecord?.note || undefined,
  });
}

/** 跨科目提醒（班级点名路径）；失败由调用方捕获 */
export async function notifyCrossSubjectIfNeeded(input: {
  senderId: string;
  student: Student;
  pkg: CoursePackage;
  studentSubject?: Subject | null;
  hoursUsed: number;
  isCrossSubject: boolean;
}): Promise<void> {
  if (!input.isCrossSubject) return;
  await notificationService.send({
    sender_id: input.senderId,
    receiver_id: 'principal',
    title: '跨科目消课提醒',
    content: `${input.student.name} 使用「${input.pkg.name}」课包消课 ${input.hoursUsed} 课时（班级科目：${input.studentSubject?.name || '通用'}）`,
    related_id: input.student.id,
  });
}
