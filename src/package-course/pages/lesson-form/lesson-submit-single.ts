/**
 * 单人快速消课提交（Q2-2）
 */
import Taro from '@tarojs/taro';
import { lessonRecordService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { SubmitLock } from '@/utils/submit-lock';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import { validateSingleSubmit, withSubmitLock } from './lesson-submit';

export async function executeSingleDeduct(input: {
  selectedStudent?: Student | null;
  matchedPackage?: CoursePackage | null;
  hoursUsed: number;
  lessonDate: string;
  selectedTeachingTeacherId?: string;
  currentTeacherId?: string;
  currentUserId?: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  campusId?: string;
  room?: string;
  profile?: {
    id?: string;
    name?: string;
    currentContext?: { role?: string } | null;
  } | null;
  submitLock: SubmitLock;
  setSubmitting: (v: boolean) => void;
  invalidateStudents: (userId?: string) => void;
  onSuccess: () => void;
}): Promise<void> {
  const error = validateSingleSubmit({
    hasStudent: !!input.selectedStudent,
    hasPackage: !!input.matchedPackage,
    hoursUsed: input.hoursUsed,
  });
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }

  const selectedStudent = input.selectedStudent!;
  const matchedPackage = input.matchedPackage!;

  const result = await withSubmitLock(input.submitLock, input.setSubmitting, async () => {
    try {
      const createdRecord = await lessonRecordService.create({
        teacher_id: input.selectedTeachingTeacherId || input.currentTeacherId || '',
        operator_teacher_id: input.currentTeacherId || input.selectedTeachingTeacherId,
        student_id: selectedStudent.id,
        package_id: matchedPackage.id,
        lesson_date: input.lessonDate,
        hours_used: input.hoursUsed,
        content: input.content.trim() || undefined,
        performance: input.performance > 0 ? `${input.performance}星` : undefined,
        homework: input.homework.trim() || undefined,
        homework_images: input.homeworkImages.length > 0 ? input.homeworkImages : undefined,
        campus_id: input.campusId || undefined,
        room: input.room || undefined,
      });

      await notifyStudentParentsSafe({
        studentId: selectedStudent.id,
        senderId: input.profile?.id || '',
        title: `${selectedStudent.name} 课时已消课`,
        content: `本次消课 ${input.hoursUsed} 课时，剩余 ${
          createdRecord.remaining_hours ?? Math.max(matchedPackage.remaining_hours - input.hoursUsed, 0)
        } 课时`,
        logLabel: 'lesson-form notify parents after single deduct',
      });

      input.invalidateStudents(input.currentUserId);
      try {
        await auditLogService.record({
          action: 'lesson.record',
          operatorId: input.currentUserId || input.profile?.id || '',
          operatorName: input.profile?.name || '未知',
          operatorRole: input.profile?.currentContext?.role || 'unknown',
          targetType: 'lesson_record',
          targetId: createdRecord.id,
          detail: `单人消课：学员「${selectedStudent.name}」消课 ${input.hoursUsed} 课时（课包「${matchedPackage.name || matchedPackage.id}」）`,
          meta: {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            packageId: matchedPackage.id,
            hours: input.hoursUsed,
          },
        });
      } catch (e) {
        logError('audit lesson.record', e);
      }
      input.onSuccess();
    } catch (err) {
      logError('submit lesson', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  });

  if (result === 'busy') return;
}
