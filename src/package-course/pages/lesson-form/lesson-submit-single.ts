/**
 * 单人快速消课提交（Q2-2）
 */
import Taro from '@tarojs/taro';
import { lessonRecordService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import {
  resolveLessonDeduction,
  resolveRemainingAfterDeduct,
} from '@/utils/lesson-deduction-source';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import type { SubmitLock } from '@/utils/submit-lock';
import { validateSingleSubmit, withSubmitLock } from './lesson-submit';

export async function executeSingleDeduct(input: {
  selectedStudent?: Student | null;
  /** 本次消课要扣的会员卡。 */
  matchedMemberCard?: MemberCardDetail | null;
  hoursUsed: number;
  lessonDate: string;
  /** 本节排课规则 ID：写入记录后用于区分「同班同一天的另一节课」 */
  scheduleId?: string;
  /** 所属班级：班课里的单人签到必须带上，卡片/名单才能按班级匹配到这条记录 */
  classId?: string;
  /**
   * 记录类型。默认不传 = 后端按 normal 落库（历史行为）。
   * 「补课并签到」场景必须传 `makeup`（与班级点名的口径一致：补课学员记 makeup）。
   */
  recordStatus?: 'normal' | 'makeup';
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
  /** 失败回调（toast 之后调用）：调用方需要自行判断成败时用（例如自动签到要报原因） */
  onError?: (err: unknown) => void;
}): Promise<void> {
  const error = validateSingleSubmit({
    hasStudent: !!input.selectedStudent,
    // 有会员卡（课时来源）就能消课
    hasPackage: !!input.matchedMemberCard,
    hoursUsed: input.hoursUsed,
  });
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }

  const selectedStudent = input.selectedStudent!;
  // 扣哪张卡（唯一口径见 utils/lesson-deduction-source）
  const deduction = resolveLessonDeduction({
    memberCards: input.matchedMemberCard ? [input.matchedMemberCard] : [],
    hoursNeeded: input.hoursUsed,
  });
  if (!deduction) {
    Taro.showToast({ title: '该学员没有可用课时', icon: 'none' });
    input.onError?.(new Error('无可扣减来源'));
    return;
  }

  const result = await withSubmitLock(input.submitLock, input.setSubmitting, async () => {
    try {
      const createdRecord = await lessonRecordService.create({
        teacher_id: input.selectedTeachingTeacherId || input.currentTeacherId || '',
        operator_teacher_id: input.currentTeacherId || input.selectedTeachingTeacherId,
        student_id: selectedStudent.id,
        member_card_id: deduction.id,
        class_id: input.classId || undefined,
        schedule_id: input.scheduleId || undefined,
        lesson_date: input.lessonDate,
        hours_used: input.hoursUsed,
        status: input.recordStatus,
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
        content: `本次消课 ${input.hoursUsed} 课时，剩余 ${resolveRemainingAfterDeduct(
          createdRecord.remaining_hours,
          input.matchedMemberCard ?? undefined,
          input.hoursUsed,
        )} 课时`,
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
          detail: `单人消课：学员「${selectedStudent.name}」消课 ${input.hoursUsed} 课时（会员卡「${deduction.name}」）`,
          meta: {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            memberCardId: deduction.id,
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
      input.onError?.(err);
    }
  });

  if (result === 'busy') return;
}
