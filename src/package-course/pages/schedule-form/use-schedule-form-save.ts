/**
 * 排课表单保存编排：调课 / 冲突检测 / 创建编辑落库 / 通知与回跳（Q2-3）
 */
import Taro from '@tarojs/taro';
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  calendarSyncService,
  classService,
  notificationService,
  scheduleService,
  studentService,
  subscribeMessageService,
  temporaryRescheduleService,
} from '@/services';
import type { Room } from '@/types/campus';
import type { Class } from '@/types/class';
import type { UserRole } from '@/types/profile';
import type { DayOfWeek, Schedule, ScheduleColor } from '@/types/schedule';
import type { ScheduleConflictResult } from '@/types/schedule-conflict';
import { logError } from '@/utils/logger';
import {
  buildScheduleRuleNote,
  buildScheduleSaveSuccessTitle,
  buildScheduleSaveTargets,
  mergeScheduleConflictResults,
} from './schedule-form-save';
import { formatRescheduleTimeLabel, validateRescheduleSaveInput } from './schedule-form-validate';
import type {
  AutoOpenType,
  EndMode,
  RepeatMode,
  SchedulingMode,
  TimeSlotPair,
} from './schedule-form-constants';

export interface UseScheduleFormSaveParams {
  saving: boolean;
  setSaving: Dispatch<SetStateAction<boolean>>;
  submitBlockedReason: string;
  isRescheduleMode: boolean;
  isEdit: boolean;
  isGroupMode: boolean;
  originalSchedule: Schedule | null;
  sourceLessonDateText: string;
  selectedDateValue: string;
  startTime: string;
  endTime: string;
  currentUserId: string;
  allSchedules: Schedule[];
  mode: 'student' | 'class';
  classId: string;
  selectedClass: Class | null;
  profileRole?: UserRole | null;
  profileCampusId?: string;
  note: string;
  autoOpenType: AutoOpenType;
  slotMaxCount: number;
  minOpenCount: number;
  schedulingMode: SchedulingMode;
  repeatMode: RepeatMode;
  startDate: string;
  endMode: EndMode;
  endDate: string;
  endCount: number;
  scheduleOnHoliday: boolean;
  consumedHours: number;
  selectedDays: DayOfWeek[];
  freeDates: string[];
  timeSlots: TimeSlotPair[];
  rooms: Room[];
  room: string;
  selectedTeachingTeacherId: string;
  selectedAssistantTeacherId: string;
  studentId: string;
  scheduleId: string;
  color: ScheduleColor;
  reminderMinutes: number;
  ignoreConflictRef: MutableRefObject<boolean>;
  setConflictResult: Dispatch<SetStateAction<ScheduleConflictResult | null>>;
  setConflictDialogVisible: Dispatch<SetStateAction<boolean>>;
  invalidateClasses: (teacherId: string, campusId?: string) => void;
  currentCampusId: string;
  setClasses: Dispatch<SetStateAction<Class[]>>;
}

export function useScheduleFormSave(params: UseScheduleFormSaveParams) {
  const {
    saving,
    setSaving,
    submitBlockedReason,
    isRescheduleMode,
    isEdit,
    isGroupMode,
    originalSchedule,
    sourceLessonDateText,
    selectedDateValue,
    startTime,
    endTime,
    currentUserId,
    allSchedules,
    mode,
    classId,
    selectedClass,
    profileRole,
    profileCampusId,
    note,
    autoOpenType,
    slotMaxCount,
    minOpenCount,
    schedulingMode,
    repeatMode,
    startDate,
    endMode,
    endDate,
    endCount,
    scheduleOnHoliday,
    consumedHours,
    selectedDays,
    freeDates,
    timeSlots,
    rooms,
    room,
    selectedTeachingTeacherId,
    selectedAssistantTeacherId,
    studentId,
    scheduleId,
    color,
    reminderMinutes,
    ignoreConflictRef,
    setConflictResult,
    setConflictDialogVisible,
    invalidateClasses,
    currentCampusId,
    setClasses,
  } = params;

  /* ---- 通知 ---- */
  const handleNotifyStudentAndParents = useCallback(
    async (sid: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: sid,
          title,
          content,
          related_id: sid,
        });
      } catch {
        /* ignore */
      }
      try {
        const parents = await studentService.getParents(sid);
        for (const p of parents) {
          if (!p.parent_id) continue;
          try {
            await notificationService.send({
              sender_id: currentUserId,
              receiver_id: p.parent_id,
              title,
              content,
              related_id: sid,
            });
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    },
    [currentUserId],
  );

  /* ---- 保存 ---- */
  const handleSave = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    /* 调课分支 */
    if (isRescheduleMode) {
      const rescheduleError = validateRescheduleSaveInput({
        originalSchedule,
        sourceLessonDate: sourceLessonDateText,
        targetDate: selectedDateValue,
        startTime,
        endTime,
      });
      if (rescheduleError) {
        Taro.showToast({ title: rescheduleError, icon: 'none' });
        return;
      }
      const sd = sourceLessonDateText;
      const td = selectedDateValue;
      const adj: Schedule = { ...originalSchedule!, start_time: startTime, end_time: endTime };
      const conflictResult = await temporaryRescheduleService.checkDateConflict({
        teacherId: currentUserId,
        sourceDate: sd,
        targetDate: td,
        movingSchedules: [adj],
        allSchedules,
      });
      if (conflictResult.hasConflict) {
        Taro.showToast({ title: '目标日期存在时间冲突', icon: 'none', duration: 3000 });
        return;
      }
      setSaving(true);
      try {
        await temporaryRescheduleService.saveBatch({
          teacherId: currentUserId,
          sourceDate: sd,
          targetDate: td,
          schedules: [adj],
        });
        const ot = formatRescheduleTimeLabel(
          sd,
          originalSchedule!.start_time,
          originalSchedule!.end_time,
        );
        const nt = formatRescheduleTimeLabel(td, startTime, endTime);
        if (mode === 'class' && classId) {
          const cs = await classService.getStudents(classId);
          for (const s of cs)
            await handleNotifyStudentAndParents(
              s.id,
              '调课通知',
              `${selectedClass?.name || '班级课程'} 已由 ${ot} 调整为 ${nt}，仅本次生效。`,
            );
        }
        try {
          Taro.setStorageSync('yunce:schedule:refresh', String(Date.now()));
        } catch (err) {
          logError('emit schedule refresh signal', err);
        }
        Taro.showToast({ title: '调课成功', icon: 'success', duration: 800 });
        void (async () => {
          try {
            await subscribeMessageService.runFlow('E07', {
              className: selectedClass?.name || '',
              role: profileRole ?? undefined,
              campusId: profileCampusId,
            });
          } catch (error) {
            logError('subscribe E07 after reschedule', error);
          }
          try {
            await calendarSyncService.maybePromptAfterScheduleSave({
              userId: currentUserId,
              teacherId: currentUserId,
              campusId: profileCampusId,
              role: profileRole ?? undefined,
            });
          } catch (error) {
            logError('calendar prompt after reschedule', error);
          }
        })();
        setTimeout(() => {
          Taro.navigateBack({
            fail: () => {
              void Taro.switchTab({ url: '/pages/schedule/index' });
            },
          });
        }, 500);
      } catch {
        Taro.showToast({ title: '调课失败', icon: 'none' });
      } finally {
        setSaving(false);
      }
      return;
    }

    /* 创建/编辑排课 */
    const buildRuleNote = () =>
      buildScheduleRuleNote({
        note,
        isGroupMode,
        autoOpenType,
        slotMaxCount,
        minOpenCount,
        schedulingMode,
        repeatMode,
        startDate,
        endMode,
        endDate,
        endCount,
        scheduleOnHoliday,
        consumedHours,
      });

    const targets = buildScheduleSaveTargets({
      schedulingMode,
      repeatMode,
      startDate,
      selectedDays,
      freeDates,
      timeSlots,
    });

    if (targets.length === 0) {
      Taro.showToast({ title: '请完善排课时间', icon: 'none' });
      return;
    }

    const roomName = rooms.find((r) => r.id === room)?.name || room || undefined;
    const teacherIdForCheck = selectedTeachingTeacherId || currentUserId;

    if (!ignoreConflictRef.current) {
      const results: ScheduleConflictResult[] = [];
      for (const t of targets) {
        results.push(
          await scheduleService.checkConflict({
            teacherId: teacherIdForCheck,
            dayOfWeek: t.dayOfWeek,
            startTime: t.start,
            endTime: t.end,
            classId: mode === 'class' ? classId : undefined,
            room: roomName,
            excludeId: isEdit ? scheduleId : undefined,
            dateHint: t.dateHint || (schedulingMode === 'rule' ? startDate : undefined),
          }),
        );
      }
      const merged = mergeScheduleConflictResults(results);
      if (merged.hasConflict) {
        setConflictResult(merged);
        setConflictDialogVisible(true);
        return;
      }
    }

    const primary = targets[0];
    const emitScheduleRefresh = () => {
      try {
        Taro.setStorageSync('yunce:schedule:refresh', String(Date.now()));
      } catch (err) {
        logError('emit schedule refresh signal', err);
      }
    };
    const goBackToSchedule = () => {
      Taro.navigateBack({
        fail: () => {
          void Taro.switchTab({ url: '/pages/schedule/index' });
        },
      });
    };

    const doSave = async () => {
      setSaving(true);
      try {
        // 团课：预约设置写回班级，与时段配置同源
        if (isGroupMode && mode === 'class' && classId) {
          await classService.update(classId, {
            auto_open_type: autoOpenType,
            min_open_count: Math.max(1, minOpenCount),
            student_count: Math.max(1, slotMaxCount),
          });
          if (currentUserId) {
            invalidateClasses(currentUserId, currentCampusId || undefined);
          }
          setClasses((prev) =>
            prev.map((c) =>
              c.id === classId
                ? {
                    ...c,
                    auto_open_type: autoOpenType,
                    min_open_count: Math.max(1, minOpenCount),
                    student_count: Math.max(1, slotMaxCount),
                  }
                : c,
            ),
          );
        }

        const baseNote = buildRuleNote();
        const ignoreConflict = ignoreConflictRef.current;
        const ruleStartDate = schedulingMode === 'rule' ? startDate : undefined;
        const ruleEndDate =
          schedulingMode === 'rule' && endMode === 'by_date' ? endDate : undefined;
        if (isEdit) {
          const data: Partial<Schedule> & {
            ignoreConflict?: boolean;
            start_date?: string;
            end_date?: string;
            maxOccurrences?: number;
          } = {
            teacher_id: selectedTeachingTeacherId || currentUserId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: mode === 'student' ? studentId : undefined,
            class_id: mode === 'class' ? classId : undefined,
            day_of_week: primary.dayOfWeek,
            start_time: primary.start,
            end_time: primary.end,
            room: roomName,
            color,
            note: baseNote,
            reminder_minutes: reminderMinutes,
            ignoreConflict,
            start_date: ruleStartDate || primary.dateHint,
            end_date: ruleEndDate,
            maxOccurrences:
              schedulingMode === 'rule' && endMode === 'by_count' ? endCount : undefined,
          };
          await scheduleService.update(scheduleId, data);
        } else {
          for (const t of targets) {
            const dateLine = t.dateHint ? `日期:${t.dateHint}` : '';
            const data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> & {
              ignoreConflict?: boolean;
              start_date?: string;
              end_date?: string;
              maxOccurrences?: number;
            } = {
              teacher_id: selectedTeachingTeacherId || currentUserId,
              assistant_teacher_id: selectedAssistantTeacherId || undefined,
              student_id: mode === 'student' ? studentId : undefined,
              class_id: mode === 'class' ? classId : undefined,
              day_of_week: t.dayOfWeek,
              start_time: t.start,
              end_time: t.end,
              room: roomName,
              color,
              note: [baseNote, dateLine].filter(Boolean).join('\n') || undefined,
              reminder_minutes: reminderMinutes,
              ignoreConflict,
              start_date: t.dateHint || ruleStartDate,
              end_date:
                ruleEndDate ||
                (t.dateHint && selectedClass?.type === 'limited' ? t.dateHint : undefined),
              maxOccurrences:
                schedulingMode === 'rule' && endMode === 'by_count'
                  ? endCount
                  : schedulingMode === 'free' && selectedClass?.type === 'limited'
                    ? 1
                    : undefined,
            };
            await scheduleService.create(data);
          }
        }
        ignoreConflictRef.current = false;
        emitScheduleRefresh();
        Taro.showToast({
          title: buildScheduleSaveSuccessTitle({ isEdit, targetCount: targets.length }),
          icon: 'success',
          duration: 800,
        });
        // 订阅授权后再询问日历同步；不阻断返回课表
        void (async () => {
          try {
            await subscribeMessageService.runFlow('E07', {
              className: selectedClass?.name || '',
              role: profileRole ?? undefined,
              campusId: profileCampusId,
            });
          } catch (error) {
            logError('subscribe E07 after schedule save', error);
          }
          try {
            await calendarSyncService.maybePromptAfterScheduleSave({
              userId: currentUserId,
              teacherId: currentUserId,
              campusId: profileCampusId,
              role: profileRole ?? undefined,
            });
          } catch (error) {
            logError('calendar prompt after schedule save', error);
          }
        })();
        setTimeout(goBackToSchedule, 500);
      } catch (err) {
        logError('schedule-form save', err);
        const message = err instanceof Error ? err.message : '';
        if (message.includes('冲突') || message.includes('409')) {
          Taro.showToast({ title: '存在排课冲突，请返回修改或忽略后重试', icon: 'none' });
        } else {
          Taro.showToast({
            title: message && message.length < 40 ? message : '保存失败，请稍后重试',
            icon: 'none',
          });
        }
      } finally {
        setSaving(false);
      }
    };
    await doSave();
  }, [
    allSchedules,
    classId,
    color,
    consumedHours,
    currentUserId,
    endCount,
    endDate,
    endMode,
    freeDates,
    handleNotifyStudentAndParents,
    isEdit,
    isGroupMode,
    isRescheduleMode,
    minOpenCount,
    autoOpenType,
    slotMaxCount,
    invalidateClasses,
    currentCampusId,
    mode,
    note,
    originalSchedule,
    profileCampusId,
    profileRole,
    reminderMinutes,
    repeatMode,
    room,
    rooms,
    saving,
    scheduleId,
    scheduleOnHoliday,
    schedulingMode,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedDateValue,
    selectedDays,
    selectedTeachingTeacherId,
    startDate,
    startTime,
    endTime,
    studentId,
    submitBlockedReason,
    sourceLessonDateText,
    timeSlots,
  ]);

  return { handleSave };
}
