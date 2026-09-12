/**
 * 补录 / 增量编辑提交编排（Q2-2）
 */
import Taro from '@tarojs/taro';
import { auditLogService } from '@/services/audit-log';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import type { SubmitLock } from '@/utils/submit-lock';
import { persistStudentAttendanceRecord } from './lesson-persist-attendance';
import {
  filterChangedAttendanceStudents,
  validateIncrementalEditSave,
  validateSupplementSave,
  withSubmitLock,
} from './lesson-submit';
import type { CheckinStatus } from './checkin-status';
import type { PersistAttendanceContext } from './lesson-persist-attendance';

type PersistShared = Omit<
  PersistAttendanceContext,
  'student' | 'status' | 'isSupplement' | 'existingRecord'
>;

export type BatchSaveUi = {
  submitLock: SubmitLock;
  setSubmitting: (v: boolean) => void;
  invalidateStudents: (userId?: string) => void;
  currentUserId?: string;
  onSuccess: (title: string) => Promise<void>;
};

async function runBatchAttendanceSave(input: {
  students: Student[];
  getStatus: (id: string) => CheckinStatus;
  isSupplement?: boolean;
  getExistingRecord: (studentId: string) => PersistAttendanceContext['existingRecord'];
  shared: PersistShared;
  audit?: {
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    hoursUsed: number;
  };
  ui: BatchSaveUi;
  successTitle: (count: number) => string;
  logPrefix: string;
}): Promise<void> {
  const result = await withSubmitLock(input.ui.submitLock, input.ui.setSubmitting, async () => {
    const successNames: string[] = [];
    const failList: { name: string; reason: string }[] = [];

    for (const student of input.students) {
      const status = input.getStatus(student.id);
      try {
        await persistStudentAttendanceRecord({
          ...input.shared,
          student,
          status,
          isSupplement: input.isSupplement,
          existingRecord: input.getExistingRecord(student.id),
        });
        successNames.push(student.name);
      } catch (error) {
        logError(`${input.logPrefix} single student`, error);
        failList.push({
          name: student.name,
          reason: error instanceof Error ? error.message : '保存失败',
        });
      }
    }

    if (successNames.length > 0) {
      if (input.audit) {
        try {
          await auditLogService.record({
            action: 'lesson.record',
            operatorId: input.audit.operatorId,
            operatorName: input.audit.operatorName,
            operatorRole: input.audit.operatorRole,
            targetType: 'lesson_record',
            detail: `补录签到：${successNames.join('、')}`,
            meta: {
              count: successNames.length,
              names: successNames,
              hours: input.audit.hoursUsed,
            },
          });
        } catch (error) {
          logError('audit supplement lesson.record', error);
        }
      }
      input.ui.invalidateStudents(input.ui.currentUserId);
    }

    if (failList.length === 0) {
      await input.ui.onSuccess(input.successTitle(successNames.length));
    } else if (successNames.length === 0) {
      Taro.showToast({ title: failList[0]?.reason || '保存失败', icon: 'none' });
    } else {
      Taro.showToast({
        title: `${successNames.length}人成功，${failList.length}人失败`,
        icon: 'none',
        duration: 3000,
      });
      await input.ui.onSuccess(input.successTitle(successNames.length));
    }
  });

  if (result === 'busy') return;
}

export async function executeSupplementSave(input: {
  selectedClassId?: string | null;
  supplementStudentIds: Set<string>;
  checkedStudentIds: Set<string>;
  classStudents: Student[];
  hoursUsed: number;
  getStatus: (id: string) => CheckinStatus;
  getExistingRecord: (studentId: string) => PersistAttendanceContext['existingRecord'];
  shared: PersistShared;
  operator: {
    id: string;
    name: string;
    role: string;
  };
  ui: BatchSaveUi;
}): Promise<void> {
  const error = validateSupplementSave({
    selectedClassId: input.selectedClassId,
    supplementCount: input.supplementStudentIds.size,
    hoursUsed: input.hoursUsed,
  });
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }

  const supplementStudents = input.classStudents.filter((student) =>
    input.supplementStudentIds.has(student.id),
  );
  const checkedCount = supplementStudents.filter((student) =>
    input.checkedStudentIds.has(student.id),
  ).length;

  const confirmResult = await Taro.showModal({
    title: '确认补录',
    content: `将为 ${supplementStudents.length} 名学员追加本节课记录（签到 ${checkedCount} 人），不影响原有已点名学员。`,
    confirmText: '保存补录',
    confirmColor: '#3B6EF5',
  });
  if (!confirmResult.confirm) return;

  try {
    await runBatchAttendanceSave({
      students: supplementStudents,
      getStatus: input.getStatus,
      isSupplement: true,
      getExistingRecord: input.getExistingRecord,
      shared: input.shared,
      audit: {
        operatorId: input.operator.id,
        operatorName: input.operator.name,
        operatorRole: input.operator.role,
        hoursUsed: input.hoursUsed,
      },
      ui: input.ui,
      successTitle: (count) => `已补录 ${count} 人`,
      logPrefix: 'supplement',
    });
  } catch (innerErr) {
    logError('handleSupplementSave', innerErr);
    Taro.showToast({ title: '补录失败，请重试', icon: 'none' });
  }
}

export async function executeIncrementalEditSave(input: {
  selectedClassId?: string | null;
  classStudents: Student[];
  hoursUsed: number;
  attendanceBaseline: Map<string, CheckinStatus>;
  getStatus: (id: string) => CheckinStatus;
  getExistingRecord: (studentId: string) => PersistAttendanceContext['existingRecord'];
  shared: PersistShared;
  onNoChange: () => void;
  ui: BatchSaveUi;
}): Promise<void> {
  const error = validateIncrementalEditSave({
    selectedClassId: input.selectedClassId,
    hoursUsed: input.hoursUsed,
  });
  if (error) {
    Taro.showToast({ title: error, icon: 'none' });
    return;
  }

  const changedStudents = filterChangedAttendanceStudents(
    input.classStudents,
    input.getStatus,
    input.attendanceBaseline,
  );

  if (changedStudents.length === 0) {
    Taro.showToast({ title: '暂无变更', icon: 'none' });
    input.onNoChange();
    return;
  }

  const confirmResult = await Taro.showModal({
    title: '确认保存修改',
    content: `将更新 ${changedStudents.length} 名学员的本节课出勤记录，不影响未变更学员。`,
    confirmText: '保存修改',
    confirmColor: '#2563eb',
  });
  if (!confirmResult.confirm) return;

  try {
    await runBatchAttendanceSave({
      students: changedStudents,
      getStatus: input.getStatus,
      getExistingRecord: input.getExistingRecord,
      shared: input.shared,
      ui: input.ui,
      successTitle: (count) => `已更新 ${count} 人`,
      logPrefix: 'incremental edit',
    });
  } catch (innerErr) {
    logError('handleIncrementalEditSave', innerErr);
    Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
  }
}
