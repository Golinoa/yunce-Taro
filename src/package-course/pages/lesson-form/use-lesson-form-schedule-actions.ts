/**
 * 点名页「排课级」操作：单次调课 / 临时停课（只停今天这一节）/ 删除排课。
 *
 * 与 use-lesson-form-actions（点名、消课、补录）分开：这里三件事操作的对象是**排课**，
 * 不是学员课时，且都依赖 URL 里的 `scheduleId`（由 `buildLessonFormPath` 带上）。
 *
 * 口径（2026-09-28 用户拍板）：
 * - 调课：只把今天这一节换到别的时间段，长期仍挂原排课规则（复用 schedule-form 的 reschedule 模式）。
 * - 停课：只停今天这一节。理由**选填**——填了写进 LessonRecord.remark，并把理由**原文**
 *         作为停课原因通知家长（不额外加任何文案）；不填则只停课、**不发通知**。
 *         仅对未点名的课可用（已点名=课时已消耗，需走取消/退课时）。
 * - 删除：删除这条排课规则（后端硬删，不可找回）；**历史点名记录保留**。
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import {
  classService,
  lessonRecordService,
  notificationService,
  scheduleService,
  studentService,
} from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import type { LessonRecord } from '@/types/lesson-record';
import { filterCancelledRecordsForRestore, isLessonCancelled } from '@/utils/lesson-record-cancel';
import { logError } from '@/utils/logger';
import { emitScheduleRelatedRefresh } from '@/utils/refresh-signal';
import {
  buildRestoreLessonConfirmContent,
  buildSuspendLessonRecordContent,
  buildSuspendNotifyCopy,
  formatLessonChangeTime,
} from '@/utils/schedule-danger-meta';
import {
  buildBatchRescheduleSelectPath,
  buildScheduleFormEditPath,
} from '@/utils/schedule-lesson-nav';

export interface UseLessonFormScheduleActionsParams {
  /** 排课 id（来自 URL）。为空时三个操作全部不可用 */
  scheduleId: string;
  classId: string;
  /** 私教（1对1）课次没有班级：此时按学员匹配取消记录，保证也能恢复 */
  studentId?: string;
  className: string;
  /** YYYY-MM-DD */
  lessonDate: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  /** 停课理由（选填，来自理由输入弹层） */
  suspendReason: string;
  /** 本节课已点名 → 不允许停课 */
  isAlreadyChecked: boolean;
  /** 本节课（该班该日）已落库的点名记录，用于判定"是否已取消"与恢复 */
  existingClassRecords: LessonRecord[];
  profileId?: string;
  currentUserId?: string;
  /** 页面上当前展示的授课老师，写进停课记录，保证记录与界面一致 */
  teacherId?: string;
  assistantTeacherId?: string;
}

export interface LessonFormScheduleActions {
  /** 有排课 id 且非过去日期才可调课 */
  canReschedule: boolean;
  /** 有排课 id 且未点名才可停课（过去日期也不可停） */
  canSuspendLesson: boolean;
  /** 本节课已被取消（停课）→ 可把它恢复回未点名状态（过去日期不可恢复） */
  canRestoreLesson: boolean;
  /** 本节课是否为过去的日期（过去日期下，调课/编辑/停课/删除均置灰） */
  isPastLessonDate: boolean;
  suspending: boolean;
  restoring: boolean;
  deleting: boolean;
  /** 调课：进「批量调课」选择页（只覆盖当天课次，不动长期规则） */
  handleReschedule: () => void;
  /** 编辑：先选「编辑班级」或「编辑排课规则」，再进对应页面 */
  handleEdit: () => void;
  handleSuspendLesson: () => Promise<void>;
  /** 恢复本节课：删掉停课时写入的 cancelled 记录，回到未点名 */
  handleRestoreLesson: () => Promise<void>;
  handleDeleteSchedule: () => void;
}

export function useLessonFormScheduleActions(
  params: UseLessonFormScheduleActionsParams,
): LessonFormScheduleActions {
  const {
    scheduleId,
    classId,
    studentId,
    className,
    lessonDate,
    startTime,
    endTime,
    suspendReason,
    isAlreadyChecked,
    existingClassRecords,
    profileId,
    currentUserId,
    teacherId,
    assistantTeacherId,
  } = params;

  const [suspending, setSuspending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** 过去的日期不能调课：批量调课页会把早于今天的日期收敛到今天，进去会误导 */
  const isPastLessonDate = useMemo(() => dayjs(lessonDate).isBefore(dayjs(), 'day'), [lessonDate]);
  const canReschedule = Boolean(scheduleId) && !isPastLessonDate;
  const canSuspendLesson = Boolean(scheduleId) && !isAlreadyChecked && !isPastLessonDate;
  /** 取消 ≡ 停课：停课后这节课就是「已取消」，此时同一个位置给「恢复本节课」 */
  const canRestoreLesson =
    Boolean(scheduleId) &&
    !isPastLessonDate &&
    isLessonCancelled(existingClassRecords, { classId, studentId, lessonDate, scheduleId });

  /**
   * 调课：进**批量调课**选择页（与课表卡片左滑「调课」同一入口）。
   *
   * 之前这里跳的是排课表单的 `mode=reschedule`，那是**编辑规则**的页面（改的是长期排课），
   * 与「只把今天这一节挪到别的时间」不是一回事 —— 已纠正。
   */
  const handleReschedule = useCallback(() => {
    if (!scheduleId || !classId) {
      Taro.showToast({ title: '缺少排课或班级信息，无法调课', icon: 'none' });
      return;
    }
    if (isPastLessonDate) {
      Taro.showToast({ title: '过去的日期不能调课', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: buildBatchRescheduleSelectPath(lessonDate, classId) });
  }, [classId, isPastLessonDate, lessonDate, scheduleId]);

  /**
   * 编辑：与课程管理点击进入的是**同一个页面、同一套逻辑**（course-form / schedule-form 均为共享页）。
   * - 编辑班级 → `course-form?mode=class`：与课程管理列表点卡片完全同参（课程管理用 `mode`，此处保持一致）
   * - 编辑排课规则 → `schedule-form`：时间/重复规则/上课老师，**影响今后所有课次**
   *
   * 两页保存后均 emitScheduleRelatedRefresh()；返回本页时 useDidShow → loadClassStudents →
   * 名单缓存按信号时间戳判失效并重拉班级 ⇒ 编辑结果（含老师）立即可见。
   * 选项按可用性拼装；只剩一个时直接进，不再弹选择；一个都不可用则提示。
   */
  const handleEdit = useCallback(() => {
    const options: { label: string; run: () => void }[] = [];
    if (classId) {
      options.push({
        label: '编辑班级',
        run: () =>
          Taro.navigateTo({
            url: `/package-course/pages/course-form/index?id=${encodeURIComponent(classId)}&mode=class`,
          }),
      });
    }
    if (scheduleId) {
      options.push({
        label: '编辑排课规则',
        run: () => Taro.navigateTo({ url: buildScheduleFormEditPath(scheduleId) }),
      });
    }

    if (options.length === 0) {
      Taro.showToast({ title: '缺少班级与排课信息，无法编辑', icon: 'none' });
      return;
    }
    if (options.length === 1) {
      options[0].run();
      return;
    }
    // 取消会走 fail / reject，这里吞掉即可（避免未处理的 Promise 拒绝）
    void Taro.showActionSheet({
      itemList: options.map((option) => option.label),
      success: (res) => {
        options[res.tapIndex]?.run();
      },
    }).catch(() => {});
  }, [classId, scheduleId]);

  /**
   * 临时停课：只停今天这一节。
   * 理由为空 ⇒ 不发通知；有理由 ⇒ 通知里的停课原因就是理由原文。
   */
  const handleSuspendLesson = useCallback(async () => {
    if (suspending) return;
    if (!classId) {
      Taro.showToast({ title: '缺少班级信息', icon: 'none' });
      return;
    }
    if (isAlreadyChecked) {
      Taro.showToast({ title: '已点名的课程不能停课', icon: 'none' });
      return;
    }

    const reason = suspendReason.trim();
    const changeTime = formatLessonChangeTime({ lessonDate, startTime, endTime });
    const notifyCopy = buildSuspendNotifyCopy({ className, changeTime });
    const recordContent = buildSuspendLessonRecordContent({ className, startTime, endTime });

    setSuspending(true);
    try {
      /**
       * 当场拉学员：不能用页面上的本地列表——它可能还没加载完或加载失败，
       * 那样会「一条停课记录都不建却提示成功」。
       */
      const students = await classService.getStudents(classId);
      if (students.length === 0) {
        Taro.showToast({ title: '该班级没有学员，无需停课', icon: 'none' });
        return;
      }

      for (const student of students) {
        await lessonRecordService.create({
          teacher_id: teacherId || currentUserId || '',
          operator_teacher_id: currentUserId || '',
          assistant_teacher_id: assistantTeacherId || undefined,
          student_id: student.id,
          package_id: '',
          class_id: classId,
          schedule_id: scheduleId || undefined,
          lesson_date: lessonDate,
          hours_used: 0,
          status: 'cancelled',
          content: recordContent,
          /** 停课理由原样落库便于追溯；未填则不写 */
          ...(reason ? { remark: reason } : {}),
        });

        if (!reason) continue;

        const parents = await studentService.getParents(student.id);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: profileId || currentUserId || '',
            receiver_id: binding.parent_id,
            title: notifyCopy.title,
            /** 站内信正文即停课理由原文，不追加其他文案 */
            content: reason,
            related_id: student.id,
            type: 'schedule_change',
          });
          await subscribeMessageService.sendScheduleChangeToReceiver({
            receiverUserId: binding.parent_id,
            bizKey: `lesson-suspend:${scheduleId || classId}:${lessonDate}:${binding.parent_id}`,
            className,
            changeTime,
            changeReason: reason,
          });
        }
      }

      emitScheduleRelatedRefresh();
      Taro.showToast({ title: reason ? '已停课并通知家长' : '已停课', icon: 'success' });
      // 本节课已作废，返回列表（课表页会因 REFRESH_SIGNAL 重拉）
      setTimeout(() => Taro.navigateBack(), 600);
    } catch (err) {
      logError('LessonForm suspend lesson', err);
      Taro.showToast({ title: '停课失败，请重试', icon: 'none' });
    } finally {
      setSuspending(false);
    }
  }, [
    assistantTeacherId,
    classId,
    className,
    currentUserId,
    endTime,
    isAlreadyChecked,
    lessonDate,
    profileId,
    scheduleId,
    startTime,
    suspendReason,
    suspending,
    teacherId,
  ]);

  /**
   * 恢复本节课：把停课（＝取消本节开课）时写入的 `cancelled` 记录删掉，
   * 本节课回到"未点名"，可以重新点名。
   *
   * 与课表页卡片上的「恢复」是同一套口径（共用 `utils/lesson-record-cancel`）。
   * 恢复成功后返回列表（与停课后一致），课表页会因 REFRESH_SIGNAL 重拉。
   */
  const handleRestoreLesson = useCallback(async () => {
    if (restoring) return;
    // 班课看班级、私教看学员——两者都没有才无法定位这节课的记录
    if (!classId && !studentId) {
      Taro.showToast({ title: '缺少班级或学员信息，无法恢复', icon: 'none' });
      return;
    }
    const cancelledRecords = filterCancelledRecordsForRestore(existingClassRecords, {
      classId,
      studentId,
      lessonDate,
      // 只恢复本节：同班同一天多节课时不能把另一节的停课记录一起删掉
      scheduleId,
    });
    if (cancelledRecords.length === 0) {
      Taro.showToast({ title: '未找到取消记录', icon: 'none' });
      return;
    }

    const confirmCopy = buildRestoreLessonConfirmContent({
      className,
      lessonDate,
      startTime,
      endTime,
    });
    const confirmResult = await Taro.showModal({
      title: confirmCopy.title,
      content: confirmCopy.content,
      confirmText: confirmCopy.confirmText,
    });
    if (!confirmResult.confirm) return;

    setRestoring(true);
    try {
      await Promise.all(cancelledRecords.map((record) => lessonRecordService.remove(record.id)));
      emitScheduleRelatedRefresh();
      Taro.showToast({ title: '已恢复本次课程', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch (err) {
      logError('LessonForm restore lesson', err);
      Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
    } finally {
      setRestoring(false);
    }
  }, [
    classId,
    className,
    endTime,
    existingClassRecords,
    lessonDate,
    restoring,
    scheduleId,
    startTime,
    studentId,
  ]);

  /**
   * 删除排课：删除的是**这条排课规则本身**（后端 `DELETE /schedules/:id` 硬删）。
   *
   * ⚠️ 这不是"只删今天这一节"——规则被删后，**该规则下的所有课程都会从课表消失**，
   * 且无法找回。已产生的历史点名记录会保留（不参与删除）。
   */
  const handleDeleteSchedule = useCallback(() => {
    if (deleting) return;
    if (!scheduleId) {
      Taro.showToast({ title: '缺少排课信息，无法删除', icon: 'none' });
      return;
    }

    void (async () => {
      const confirmResult = await Taro.showModal({
        title: '删除排课',
        /**
         * 文案跟着口径走（用户 2026-10-01）：删除 = **自今日起停止排课**，不是抹掉历史。
         * 旧文案写的是"该规则下的所有日期课程都会从课表移除"——那正是当前行为的描述，
         * 也是用户这次否掉的那一条（历史日期上已经上过课的卡片不能消失）。
         */
        content:
          '这会停止整条排课规则：自今天起不再生成课表。历史日期的课表与已产生的点名记录都会保留。',
        confirmText: '删除排课',
      });
      if (!confirmResult.confirm) return;

      setDeleting(true);
      try {
        await scheduleService.remove(scheduleId);
        emitScheduleRelatedRefresh();
        Taro.showToast({ title: '已停止排课', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 600);
      } catch (err) {
        logError('LessonForm delete schedule', err);
        Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
      } finally {
        setDeleting(false);
      }
    })();
  }, [deleting, scheduleId]);

  return {
    canReschedule,
    canSuspendLesson,
    canRestoreLesson,
    isPastLessonDate,
    suspending,
    restoring,
    deleting,
    handleReschedule,
    handleEdit,
    handleSuspendLesson,
    handleRestoreLesson,
    handleDeleteSchedule,
  };
}
