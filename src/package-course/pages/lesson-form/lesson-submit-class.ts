/**
 * 班级点名整节提交（Q2-2）
 */
import Taro from '@tarojs/taro';
import { lessonRecordService } from '@/services';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/campus';
import type { SubmitLock } from '@/utils/submit-lock';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import { notifyCrossSubjectIfNeeded } from './lesson-persist-attendance';
import {
  buildClassAttendanceSummary,
  validateClassSubmit,
  withSubmitLock,
} from './lesson-submit';

export async function executeClassSubmit(input: {
  selectedClassId?: string | null;
  selectedClassName?: string;
  classStudents: Student[];
  trialBookings: LeadBooking[];
  presentStudents: Student[];
  leaveStudents: Student[];
  absentStudents: Student[];
  presentTrialBookings: LeadBooking[];
  leaveTrialBookings: LeadBooking[];
  absentTrialBookings: LeadBooking[];
  classAbsentCount: number;
  hoursUsed: number;
  lessonDate: string;
  selectedTeachingTeacherId?: string;
  currentTeacherId?: string;
  selectedAssistantTeacherId?: string;
  currentUserId?: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  campusId?: string;
  room?: string;
  studentPackages: Map<string, CoursePackage>;
  studentSubjects: Map<string, Subject | null>;
  studentRemarkDrafts: Record<string, string>;
  trialLeadMap: Record<string, Lead | undefined>;
  profileId?: string;
  loadLessonRecordsByDate: () => Promise<LessonRecord[]>;
  submitLock: SubmitLock;
  setSubmitting: (v: boolean) => void;
  invalidateStudents: (userId?: string) => void;
  onSuccess: (
    title: string,
    icon: 'success' | 'none',
    duration: number,
    options?: { renewSubscribe?: boolean },
  ) => void;
}): Promise<void> {
  const error = validateClassSubmit({
    selectedClassId: input.selectedClassId,
    formalCount: input.classStudents.length,
    trialCount: input.trialBookings.length,
    hoursUsed: input.hoursUsed,
  });
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }

  const attendanceSummaryText = buildClassAttendanceSummary({
    presentCount: input.presentStudents.length,
    leaveCount: input.leaveStudents.length,
    absentCount: input.classAbsentCount,
    hoursUsed: input.hoursUsed,
    trialPresentCount: input.presentTrialBookings.length,
    trialAbsentCount: input.absentTrialBookings.length,
    hasTrials: input.trialBookings.length > 0,
  });

  const confirmResult = await Taro.showModal({
    title: '确认消课',
    content: `确认提交“${input.selectedClassName || '该班级'}”点名结果？\n${attendanceSummaryText}`,
    confirmText: '确认消课',
    confirmColor: '#2563eb',
  });
  if (!confirmResult.confirm) return;

  const result = await withSubmitLock(input.submitLock, input.setSubmitting, async () => {
    let successCount = 0;
    const failList: { name: string; reason: string }[] = [];

    try {
      const lessonDateValue = input.lessonDate;
      const selectedClassId = input.selectedClassId!;
      const existingRecords = await input.loadLessonRecordsByDate();
      const trialStudentIds = new Set(input.trialBookings.map((b) => b.trial_student_id));
      const existingSubmitRecords = existingRecords.filter(
        (record) =>
          record.class_id === selectedClassId &&
          record.lesson_date === lessonDateValue &&
          (input.classStudents.some((student) => student.id === record.student_id) ||
            trialStudentIds.has(record.student_id)),
      );

      await Promise.all(
        existingSubmitRecords
          .filter((record) =>
            ['normal', 'makeup', 'leave', 'absent'].includes(record.status || 'normal'),
          )
          .map((record) => lessonRecordService.remove(record.id)),
      );

      const teacherPayload = {
        teacher_id: input.selectedTeachingTeacherId || input.currentTeacherId || '',
        operator_teacher_id: input.currentTeacherId || input.selectedTeachingTeacherId,
        assistant_teacher_id: input.selectedAssistantTeacherId || undefined,
        class_id: selectedClassId,
        lesson_date: lessonDateValue,
        campus_id: input.campusId || undefined,
        room: input.room || undefined,
      };

      for (const student of input.presentStudents) {
        const pkg = input.studentPackages.get(student.id);
        if (!pkg) {
          failList.push({ name: student.name, reason: '无可用课包' });
          continue;
        }

        try {
          const studentSubject = input.studentSubjects.get(student.id);
          const isCrossSubject =
            !!pkg.subject_id && !!studentSubject && pkg.subject_id !== studentSubject.id;

          const createdRecord = await lessonRecordService.create({
            ...teacherPayload,
            student_id: student.id,
            package_id: pkg.id,
            hours_used: input.hoursUsed,
            is_cross_subject: isCrossSubject || undefined,
            package_subject: isCrossSubject ? pkg.name : undefined,
            class_subject: isCrossSubject ? studentSubject?.name : undefined,
            content: input.content.trim() || undefined,
            note: input.studentRemarkDrafts[student.id] || undefined,
            performance: input.performance > 0 ? `${input.performance}星` : undefined,
            homework: input.homework.trim() || undefined,
            homework_images: input.homeworkImages.length > 0 ? input.homeworkImages : undefined,
          });

          await notifyCrossSubjectIfNeeded({
            senderId: input.profileId || '',
            student,
            pkg,
            studentSubject,
            hoursUsed: input.hoursUsed,
            isCrossSubject,
          });

          await notifyStudentParentsSafe({
            studentId: student.id,
            senderId: input.profileId || '',
            title: `${student.name} 课时已核销`,
            content: `本次核销 ${input.hoursUsed} 课时，剩余 ${
              createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - input.hoursUsed, 0)
            } 课时`,
            logLabel: 'lesson-form notify parents after class checkin',
          });

          successCount += 1;
        } catch (err) {
          logError('classSubmit single student', err);
          failList.push({ name: student.name, reason: '消课失败' });
        }
      }

      for (const student of input.leaveStudents) {
        try {
          await lessonRecordService.create({
            ...teacherPayload,
            student_id: student.id,
            package_id: '',
            hours_used: 0,
            status: 'leave',
            content: '家长已请假，本节课自动记为请假',
            note: input.studentRemarkDrafts[student.id] || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit leave student', err);
          failList.push({ name: student.name, reason: '请假记录失败' });
        }
      }

      for (const student of input.absentStudents) {
        try {
          await lessonRecordService.create({
            ...teacherPayload,
            student_id: student.id,
            package_id: '',
            hours_used: 0,
            status: 'absent',
            content: '点名未到，待老师后续补录签到',
            note: input.studentRemarkDrafts[student.id] || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit absent student', err);
          failList.push({ name: student.name, reason: '未到记录失败' });
        }
      }

      for (const booking of input.presentTrialBookings) {
        const lead = input.trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            ...teacherPayload,
            student_id: booking.trial_student_id,
            package_id: '',
            hours_used: 0,
            status: 'normal',
            content: `试听签到${booking.note ? `（${booking.note}）` : ''}`,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial present', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听签到记录失败' });
        }
      }

      for (const booking of input.leaveTrialBookings) {
        const lead = input.trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            ...teacherPayload,
            student_id: booking.trial_student_id,
            package_id: '',
            hours_used: 0,
            status: 'leave',
            content: '试听学员请假',
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial leave', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听请假记录失败' });
        }
      }

      for (const booking of input.absentTrialBookings) {
        const lead = input.trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            ...teacherPayload,
            student_id: booking.trial_student_id,
            package_id: '',
            hours_used: 0,
            status: 'absent',
            content: '试听预约未到',
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial absent', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听未到记录失败' });
        }
      }

      if (failList.length === 0) {
        input.invalidateStudents(input.currentUserId);
        input.onSuccess(
          `签到${input.presentStudents.length + input.presentTrialBookings.length}人（含试听${input.presentTrialBookings.length}人），请假${input.leaveStudents.length}人，未到${input.classAbsentCount + input.absentTrialBookings.length}人`,
          'success',
          1800,
          { renewSubscribe: true },
        );
      } else if (successCount === 0) {
        Taro.showToast({ title: '全部消课失败', icon: 'none' });
      } else {
        input.invalidateStudents(input.currentUserId);
        input.onSuccess(`${successCount}条记录成功，${failList.length}条失败`, 'none', 3000, {
          renewSubscribe: true,
        });
      }
    } catch (err) {
      logError('class submit', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  });

  if (result === 'busy') return;
}
