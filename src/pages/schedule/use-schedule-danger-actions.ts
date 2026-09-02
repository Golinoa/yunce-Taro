/**
 * 课表页危险操作编排：取消开课 / 恢复 / 停课 / 恢复上课 / 批量解散（Q2-1）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  calendarSyncService,
  classBookingService,
  classService,
  lessonRecordService,
  notificationService,
  scheduleService,
  studentService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { getThemeHexColors, type ThemeKey } from '@/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { UserRole } from '@/types/profile';
import type { Schedule } from '@/types/schedule';
import { createOperationLock, type OperationLock } from '@/utils/batch-operation';
import { logError } from '@/utils/logger';
import { getCardActionVisibility } from '@/utils/schedule-card-actions';
import type { ScheduleCardItem } from '@/utils/schedule-card-build';
import {
  buildCancelLessonNotifyCopy,
  buildCancelLessonRecordContent,
  buildDissolveClassNotifyContent,
  buildRestoreLessonConfirmContent,
  buildResumeClassConfirmContent,
  buildSuspendLessonConfirmContent,
  buildSuspendLessonRecordContent,
  buildSuspendNotifyCopy,
  buildSuspendOpenSlotConfirmContent,
  formatLessonChangeTime,
  type ScheduleDangerActionType,
} from '@/utils/schedule-danger-meta';
import { canSuspendOpenSlot, canSuspendThisLesson } from '@/utils/schedule-guard';

export interface ScheduleDangerActionState {
  visible: boolean;
  type: ScheduleDangerActionType | null;
  item: ScheduleCardItem | null;
}

export interface ScheduleBatchClassOption {
  id: string;
  name: string;
}

export interface UseScheduleDangerActionsParams {
  selectedDate: dayjs.Dayjs;
  currentTime: dayjs.Dayjs;
  activeTheme: ThemeKey;
  lessonRecords: LessonRecord[];
  setLessonRecords: Dispatch<SetStateAction<LessonRecord[]>>;
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
  scheduleById: Record<string, Schedule>;
  filteredClasses: Class[];
  selectedBatchClasses: ScheduleBatchClassOption[];
  selectedClassId: string;
  filterAllClassId: string;
  currentTeacherId: string;
  currentUserId: string;
  currentCampusId: string;
  profileId?: string;
  profileName?: string;
  profileRole?: UserRole;
  notifyStudentAndParents: (studentId: string, title: string, content: string) => Promise<void>;
}

export function useScheduleDangerActions(params: UseScheduleDangerActionsParams) {
  const {
    selectedDate,
    currentTime,
    activeTheme,
    lessonRecords,
    setLessonRecords,
    setOpenClassSlots,
    setClasses,
    setSchedules,
    setSelectedClassId,
    setBatchClassSheetVisible,
    setBatchSelectedClassIds,
    setDangerActionSubmitting,
    dangerActionState,
    setDangerActionState,
    closeDangerActionDialog,
    scheduleById,
    filteredClasses,
    selectedBatchClasses,
    selectedClassId,
    filterAllClassId,
    currentTeacherId,
    currentUserId,
    currentCampusId,
    profileId,
    profileName,
    profileRole,
    notifyStudentAndParents,
  } = params;

  const batchOperationLockRef = useRef<OperationLock>(createOperationLock());

  const handleCancelLesson = useCallback(
    async (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      if (!visibility.showCancelLesson) {
        Taro.showToast({ title: '过去日期课程不可取消开课', icon: 'none' });
        return;
      }

      setDangerActionState({
        visible: true,
        type: 'cancel',
        item,
      });
    },
    [currentTime, selectedDate, setDangerActionState],
  );

  const handleRestoreLesson = useCallback(
    async (item: ScheduleCardItem) => {
      if (!item.classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const cancelledRecords = lessonRecords.filter(
        (record) =>
          record.class_id === item.classId &&
          record.lesson_date === lessonDate &&
          record.status === 'cancelled',
      );

      if (cancelledRecords.length === 0) {
        Taro.showToast({ title: '未找到取消记录', icon: 'none' });
        return;
      }

      const confirmCopy = buildRestoreLessonConfirmContent({
        className: item.className,
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(activeTheme).primary,
      });

      if (!confirmResult.confirm) {
        return;
      }

      // 并发锁：已有批量操作执行中则忽略本次，避免重复请求
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('restore-lesson', async () => {
          await Promise.all(
            cancelledRecords.map((record) => lessonRecordService.remove(record.id)),
          );
          setLessonRecords((prev) =>
            prev.filter(
              (record) =>
                !(
                  record.class_id === item.classId &&
                  record.lesson_date === lessonDate &&
                  record.status === 'cancelled'
                ),
            ),
          );
          Taro.showToast({ title: '已恢复本次课程', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage restore lesson', err);
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      }
    },
    [activeTheme, lessonRecords, selectedDate, setLessonRecords],
  );

  /** 停课：仅未开课的这一节临时取消，并向学员家长发站内 + 订阅消息 */
  const handleSuspendLesson = useCallback(
    async (item: ScheduleCardItem) => {
      const classId = item.classId;
      if (!classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }
      if (!canSuspendThisLesson(item, selectedDate, currentTime)) {
        Taro.showToast({ title: '仅未开课的课程可停课', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const confirmCopy = buildSuspendLessonConfirmContent({
        className: item.className,
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      const scheduleInfo = scheduleById[item.id];
      const selectedClass =
        filteredClasses.find((classItem) => classItem.id === item.classId) || null;
      const className = selectedClass?.name || item.className;
      const changeTime = formatLessonChangeTime({
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const notifyCopy = buildSuspendNotifyCopy({ className, changeTime });

      // 并发锁：已有批量操作执行中则忽略本次，避免重复创建停课记录
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('suspend-lesson', async () => {
          const students = await classService.getStudents(classId);
          const createdRecords: LessonRecord[] = [];

          for (const student of students) {
            const createdRecord = await lessonRecordService.create({
              teacher_id: scheduleInfo?.teacher_id || currentTeacherId,
              operator_teacher_id: currentTeacherId,
              assistant_teacher_id: scheduleInfo?.assistant_teacher_id || undefined,
              student_id: student.id,
              package_id: '',
              class_id: item.classId,
              lesson_date: lessonDate,
              hours_used: 0,
              status: 'cancelled',
              content: buildSuspendLessonRecordContent({
                className: item.className,
                startTime: item.startTime,
                endTime: item.endTime,
              }),
            });
            createdRecords.push(createdRecord);

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
                bizKey: `lesson-suspend:${item.id}:${lessonDate}:${binding.parent_id}`,
                className,
                changeTime,
                changeReason: notifyCopy.changeReason,
              });
            }
          }

          setLessonRecords((prev) => {
            const filtered = prev.filter(
              (record) => !(record.class_id === item.classId && record.lesson_date === lessonDate),
            );
            return [...filtered, ...createdRecords];
          });
          Taro.showToast({ title: '已停课并通知家长', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage suspend lesson', err);
        Taro.showToast({ title: '停课失败，请重试', icon: 'none' });
      }
    },
    [
      activeTheme,
      currentTeacherId,
      currentTime,
      currentUserId,
      filteredClasses,
      profileId,
      scheduleById,
      selectedDate,
      setLessonRecords,
    ],
  );

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
          setOpenClassSlots((prev) => {
            const next = { ...prev };
            const dateKey = slot.lesson_date;
            if (next[dateKey]) {
              next[dateKey] = { ...next[dateKey] };
              const classSlots = next[dateKey][slot.class_id];
              if (classSlots) {
                next[dateKey][slot.class_id] = classSlots.map((s) =>
                  s.id === slot.id ? { ...s, status: 'rest' as const } : s,
                );
              }
            }
            return next;
          });

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
    const item = dangerActionState.item;
    if (!dangerActionState.type) {
      return;
    }

    if (dangerActionState.type === 'cancel') {
      if (!item) {
        return;
      }
      const classId = item.classId;
      if (!classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const scheduleInfo = scheduleById[item.id];
      const selectedClass =
        filteredClasses.find((classItem) => classItem.id === item.classId) || null;

      setDangerActionSubmitting(true);
      // 并发锁：已有批量操作执行中则忽略本次（与 submitting 双保险）
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) {
        setDangerActionSubmitting(false);
        return;
      }
      try {
        await lock.run('cancel-lesson', async () => {
          const students = await classService.getStudents(classId);
          const createdRecords: LessonRecord[] = [];

          for (const student of students) {
            const createdRecord = await lessonRecordService.create({
              teacher_id: scheduleInfo?.teacher_id || currentTeacherId,
              operator_teacher_id: currentTeacherId,
              assistant_teacher_id: scheduleInfo?.assistant_teacher_id || undefined,
              student_id: student.id,
              package_id: '',
              class_id: item.classId,
              lesson_date: lessonDate,
              hours_used: 0,
              status: 'cancelled',
              content: buildCancelLessonRecordContent({
                className: item.className,
                startTime: item.startTime,
                endTime: item.endTime,
              }),
            });

            createdRecords.push(createdRecord);

            const cancelNotify = buildCancelLessonNotifyCopy({
              className: selectedClass?.name || item.className,
              lessonDate,
              startTime: item.startTime,
              endTime: item.endTime,
            });
            const parents = await studentService.getParents(student.id);
            for (const binding of parents) {
              await notificationService.send({
                sender_id: profileId || currentUserId,
                receiver_id: binding.parent_id,
                title: cancelNotify.title,
                content: cancelNotify.content,
                related_id: student.id,
              });
            }
          }

          setLessonRecords((prev) => {
            const filtered = prev.filter(
              (record) => !(record.class_id === item.classId && record.lesson_date === lessonDate),
            );
            return [...filtered, ...createdRecords];
          });
          closeDangerActionDialog();
          Taro.showToast({ title: '已取消本次课程', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage cancel lesson', err);
        Taro.showToast({ title: '取消失败，请重试', icon: 'none' });
      } finally {
        setDangerActionSubmitting(false);
      }
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
          setClasses((prev) => prev.filter((classItem) => !successIds.includes(classItem.id)));
          setSchedules((prev) =>
            prev.filter((scheduleItem) => !successIds.includes(scheduleItem.class_id || '')),
          );
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

        if (failedNames.length === 0) {
          Taro.showToast({ title: `已删除 ${successIds.length} 个班级`, icon: 'success' });
        } else if (successIds.length === 0) {
          Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
        } else {
          Taro.showToast({
            title: `${successIds.length}个已删除，${failedNames.length}个失败`,
            icon: 'none',
            duration: 3000,
          });
        }
      } finally {
        setDangerActionSubmitting(false);
      }
      return;
    }

    if (!item) {
      return;
    }

    setDangerActionSubmitting(true);
    try {
      await scheduleService.remove(item.id);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== item.id));
      closeDangerActionDialog();
      Taro.showToast({ title: '排课规则已删除', icon: 'success' });
      void calendarSyncService.syncAfterScheduleChange({
        userId: currentUserId,
        teacherId: currentUserId,
        campusId: currentCampusId,
        role: profileRole,
      });
    } catch (err) {
      logError('SchedulePage remove schedule', err);
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
    } finally {
      setDangerActionSubmitting(false);
    }
  }, [
    closeDangerActionDialog,
    currentCampusId,
    currentTeacherId,
    currentUserId,
    dangerActionState.item,
    dangerActionState.type,
    filterAllClassId,
    filteredClasses,
    notifyStudentAndParents,
    profileId,
    profileName,
    profileRole,
    scheduleById,
    selectedBatchClasses,
    selectedClassId,
    selectedDate,
    setBatchClassSheetVisible,
    setBatchSelectedClassIds,
    setClasses,
    setDangerActionSubmitting,
    setLessonRecords,
    setSchedules,
    setSelectedClassId,
  ]);

  return {
    handleCancelLesson,
    handleRestoreLesson,
    handleSuspendLesson,
    handleSuspendOpenSlot,
    handleResumeClass,
    handleConfirmDangerAction,
  };
}
