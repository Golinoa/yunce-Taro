/**
 * 课表页危险操作编排：取消开课 / 恢复 / 停课 / 恢复上课 / 批量解散（Q2-1）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { classBookingService, classService, notificationService, studentService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { getThemeHexColors, type ThemeKey } from '@/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { UserRole } from '@/types/profile';
import type { Schedule } from '@/types/schedule';
import { createOperationLock, type OperationLock } from '@/utils/batch-operation';
import { logError } from '@/utils/logger';
import {
  buildDissolveClassNotifyContent,
  buildResumeClassConfirmContent,
  buildSuspendNotifyCopy,
  buildSuspendOpenSlotConfirmContent,
  formatLessonChangeTime,
  type ScheduleDangerActionType,
} from '@/utils/schedule-danger-meta';
import { canSuspendOpenSlot } from '@/utils/schedule-guard';
import {
  applyOpenSlotRestStatus,
  filterClassesAfterBatchDelete,
  filterSchedulesAfterBatchDelete,
  resolveBatchDeleteToast,
} from './schedule-danger-logic';

export interface ScheduleDangerActionState {
  visible: boolean;
  /** 现存唯一类型：批量解散班级（其余危险操作已随卡片左滑移除） */
  type: ScheduleDangerActionType | null;
}

export interface ScheduleBatchClassOption {
  id: string;
  name: string;
}

export interface UseScheduleDangerActionsParams {
  currentTime: dayjs.Dayjs;
  activeTheme: ThemeKey;
  setOpenClassSlots: Dispatch<SetStateAction<Record<string, Record<string, ClassBookingSlot[]>>>>;
  setClasses: Dispatch<SetStateAction<Class[]>>;
  setSchedules: Dispatch<SetStateAction<Schedule[]>>;
  setSelectedClassId: Dispatch<SetStateAction<string>>;
  setBatchClassSheetVisible: Dispatch<SetStateAction<boolean>>;
  setBatchSelectedClassIds: Dispatch<SetStateAction<string[]>>;
  setDangerActionSubmitting: Dispatch<SetStateAction<boolean>>;
  dangerActionState: ScheduleDangerActionState;
  setDangerActionState: Dispatch<SetStateAction<ScheduleDangerActionState>>;
  closeDangerActionDialog: () => void;
  selectedBatchClasses: ScheduleBatchClassOption[];
  selectedClassId: string;
  filterAllClassId: string;
  currentUserId: string;
  currentCampusId: string;
  profileId?: string;
  profileName?: string;
  profileRole?: UserRole;
  notifyStudentAndParents: (studentId: string, title: string, content: string) => Promise<void>;
}

export function useScheduleDangerActions(params: UseScheduleDangerActionsParams) {
  const {
    currentTime,
    activeTheme,
    setOpenClassSlots,
    setClasses,
    setSchedules,
    setSelectedClassId,
    setBatchClassSheetVisible,
    setBatchSelectedClassIds,
    setDangerActionSubmitting,
    dangerActionState,
    closeDangerActionDialog,
    selectedBatchClasses,
    selectedClassId,
    filterAllClassId,
    currentUserId,
    currentCampusId,
    profileId,
    profileName,
    profileRole,
    notifyStudentAndParents,
  } = params;

  const batchOperationLockRef = useRef<OperationLock>(createOperationLock());

  /** 团课停课：仅未开课时段，设为休息并通知已约学员家长 */
  const handleSuspendOpenSlot = useCallback(
    async (slot: ClassBookingSlot, className: string) => {
      if (!canSuspendOpenSlot(slot, currentTime)) {
        Taro.showToast({ title: '仅未开课的课程可停课', icon: 'none' });
        return;
      }

      const displayName = className || slot.class_name || '该班级';
      const changeTime = formatLessonChangeTime({
        lessonDate: slot.lesson_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
      });
      const confirmCopy = buildSuspendOpenSlotConfirmContent({ displayName, changeTime });
      const notifyCopy = buildSuspendNotifyCopy({ className: displayName, changeTime });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      // 并发锁：已有批量操作执行中则忽略本次
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('suspend-open-slot', async () => {
          await classBookingService.updateSlotStatus(slot.id, 'rest');
          setOpenClassSlots((prev) => applyOpenSlotRestStatus(prev, slot));

          const bookingStudents = slot.booking_students || [];
          for (const student of bookingStudents) {
            const parents = await studentService.getParents(student.id);
            for (const binding of parents) {
              await notificationService.send({
                sender_id: profileId || currentUserId,
                receiver_id: binding.parent_id,
                title: notifyCopy.title,
                content: notifyCopy.content,
                related_id: student.id,
                type: 'schedule_change',
              });
              await subscribeMessageService.sendScheduleChangeToReceiver({
                receiverUserId: binding.parent_id,
                bizKey: `slot-suspend:${slot.id}:${binding.parent_id}`,
                className: displayName,
                changeTime,
                changeReason: notifyCopy.changeReason,
              });
            }
          }

          Taro.showToast({ title: '已停课并通知家长', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage suspend open slot', err);
        Taro.showToast({ title: '停课失败，请重试', icon: 'none' });
      }
    },
    [activeTheme, currentTime, currentUserId, profileId, setOpenClassSlots],
  );

  /** 恢复上课 */
  const handleResumeClass = useCallback(
    async (classId: string, className: string) => {
      if (!classId) return;
      const confirmCopy = buildResumeClassConfirmContent(className);
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      try {
        const updated = await classService.resume(classId);
        if (!updated) {
          Taro.showToast({ title: '恢复失败', icon: 'none' });
          return;
        }
        setClasses((prev) =>
          prev.map((item) => (item.id === classId ? { ...item, status: 'active' } : item)),
        );
        Taro.showToast({ title: '已恢复上课', icon: 'success' });
      } catch (err) {
        logError('SchedulePage resume class', err);
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      }
    },
    [activeTheme, setClasses],
  );

  const handleConfirmDangerAction = useCallback(async () => {
    if (!dangerActionState.type) {
      return;
    }
    if (dangerActionState.type === 'batch-delete') {
      const targetClasses = selectedBatchClasses;
      if (targetClasses.length === 0) {
        Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
        return;
      }

      setDangerActionSubmitting(true);
      const successIds: string[] = [];
      const failedNames: string[] = [];

      try {
        for (const classItem of targetClasses) {
          try {
            const students = await classService.getStudents(classItem.id);
            await classService.remove(classItem.id);

            for (const student of students) {
              const dissolveNotify = buildDissolveClassNotifyContent(classItem.name);
              await notifyStudentAndParents(
                student.id,
                dissolveNotify.title,
                dissolveNotify.content,
              );
            }

            successIds.push(classItem.id);
          } catch (err) {
            logError('SchedulePage batch delete class', err);
            failedNames.push(classItem.name);
          }
        }

        if (successIds.length > 0) {
          setClasses((prev) => filterClassesAfterBatchDelete(prev, successIds));
          setSchedules((prev) => filterSchedulesAfterBatchDelete(prev, successIds));
          if (successIds.includes(selectedClassId)) {
            setSelectedClassId(filterAllClassId);
          }
        }

        closeDangerActionDialog();
        setBatchClassSheetVisible(false);
        setBatchSelectedClassIds([]);

        // 审计日志（用户口径 2026-08-22）：解散班级属高影响操作（解除学员分班+发通知）
        if (successIds.length > 0) {
          try {
            const names = selectedBatchClasses
              .filter((c) => successIds.includes(c.id))
              .map((c) => c.name);
            await auditLogService.record({
              action: 'class.dissolve',
              operatorId: profileId || '',
              operatorName: profileName || '未知',
              operatorRole: profileRole || 'unknown',
              targetType: 'class',
              targetId: successIds.join(','),
              detail: `解散班级 ${successIds.length} 个：${names.join('、')}`,
              meta: { classIds: successIds, classNames: names },
            });
          } catch (e) {
            logError('audit class.dissolve', e);
          }
        }

        const toast = resolveBatchDeleteToast(successIds.length, failedNames.length);
        Taro.showToast(toast);
      } finally {
        setDangerActionSubmitting(false);
      }
      return;
    }
  }, [
    closeDangerActionDialog,
    currentCampusId,
    currentUserId,
    dangerActionState.type,
    filterAllClassId,
    notifyStudentAndParents,
    profileId,
    profileName,
    profileRole,
    selectedBatchClasses,
    selectedClassId,
    setBatchClassSheetVisible,
    setBatchSelectedClassIds,
    setClasses,
    setDangerActionSubmitting,
    setSchedules,
    setSelectedClassId,
  ]);

  return {
    handleSuspendOpenSlot,
    handleResumeClass,
    handleConfirmDangerAction,
  };
}
