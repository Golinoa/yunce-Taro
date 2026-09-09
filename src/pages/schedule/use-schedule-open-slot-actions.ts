/**
 * 课表页开放时段 / 家长约课操作编排（Q2-1）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { classBookingService, studentService } from '@/services';
import type { CampusUIModel } from '@/types/campus';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { Profile } from '@/types/profile';
import { logError } from '@/utils/logger';
import { upsertParentBooking, updateParentBookingStatus } from '@/utils/parent-bookings';
import {
  buildOpenSlotRollCallPath,
  validateOpenSlotRollCallNav,
} from '@/utils/schedule-lesson-nav';

export interface UseScheduleOpenSlotActionsParams {
  filteredClasses: Class[];
  campuses: CampusUIModel[];
  currentCampusId: string;
  profile?: Profile | null;
  loadOpenClassSlots: (date: dayjs.Dayjs, force?: boolean) => Promise<void>;
  setOpenClassSlots: Dispatch<SetStateAction<Record<string, Record<string, ClassBookingSlot[]>>>>;
}

export function useScheduleOpenSlotActions(params: UseScheduleOpenSlotActionsParams) {
  const {
    filteredClasses,
    campuses,
    currentCampusId,
    profile,
    loadOpenClassSlots,
    setOpenClassSlots,
  } = params;

  const handleOpenClassSlotConfig = useCallback((classId: string, dateStr: string) => {
    const date = encodeURIComponent(dateStr);
    void Taro.navigateTo({
      url: `/package-lead/pages/class-slot-config/index?classId=${encodeURIComponent(classId)}&date=${date}`,
    });
  }, []);

  const handleProxyBooking = useCallback(
    (slot: ClassBookingSlot) => {
      const date = encodeURIComponent(slot.lesson_date);
      const time = encodeURIComponent(slot.start_time);
      const endTime = encodeURIComponent(slot.end_time || '');
      const className = encodeURIComponent(slot.class_name || '');
      const subjectId = filteredClasses.find((item) => item.id === slot.class_id)?.subject_id || '';
      void Taro.navigateTo({
        url:
          `/package-lead/pages/proxy-booking-form/index?teacherId=${encodeURIComponent(slot.teacher_id)}` +
          `&date=${date}&time=${time}&endTime=${endTime}&mode=group` +
          `&classId=${encodeURIComponent(slot.class_id)}&className=${className}` +
          `&subjectId=${encodeURIComponent(subjectId)}`,
      });
    },
    [filteredClasses],
  );

  /** 团课开放时段「点名」：复用 lesson-form（classId + 日期时段；有开班排课则带 scheduleId） */
  const handleOpenSlotRollCall = useCallback((slot: ClassBookingSlot) => {
    const error = validateOpenSlotRollCallNav(slot);
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: buildOpenSlotRollCallPath({
        class_id: slot.class_id!,
        lesson_date: slot.lesson_date,
        start_time: slot.start_time,
        opened_schedule_id: slot.opened_schedule_id,
      }),
    });
  }, []);

  /** 开放预约：左滑编辑时段 — 跳转到简约表单编辑页 */
  const handleEditOpenSlot = useCallback((slot: ClassBookingSlot) => {
    const date = encodeURIComponent(slot.lesson_date);
    void Taro.navigateTo({
      url:
        `/package-lead/pages/open-slot-edit/index?slotId=${encodeURIComponent(slot.id)}` +
        `&classId=${encodeURIComponent(slot.class_id)}&date=${date}`,
    });
  }, []);

  /** 家长端：团课开放时段预约 */
  const handleParentBookOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (!profile?.id) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      if (slot.status === 'rest') {
        Taro.showToast({ title: '该时段休息中', icon: 'none' });
        return;
      }

      try {
        const kids = await studentService.getByParent(profile.id);
        if (kids.length === 0) {
          Taro.showToast({ title: '暂无绑定学员', icon: 'none' });
          return;
        }

        let student = kids[0];
        if (kids.length > 1) {
          const sheet = await Taro.showActionSheet({
            itemList: kids.map((k) => k.name),
          });
          student = kids[sheet.tapIndex];
        }

        const alreadyBooked = (slot.booking_students || []).some((s) => s.id === student.id);
        if (alreadyBooked) {
          Taro.showToast({ title: '已预约该时段', icon: 'none' });
          return;
        }

        const created = await classBookingService.addBookingRecord(slot.id, student.id);
        // 本地仅缓存展示；真相源为 class-booking record id
        upsertParentBooking({
          id: created.id || `pb-${slot.id}-${student.id}`,
          userId: profile.id,
          studentId: student.id,
          studentName: student.name,
          occurrenceKey: `${slot.class_id}:${slot.lesson_date}:${slot.start_time}`,
          courseId: slot.class_id,
          courseName: slot.class_name || '团课',
          courseType: 'group',
          classId: slot.class_id,
          campusId: slot.campus_id,
          lessonDate: slot.lesson_date,
          timeRange: `${slot.start_time}-${slot.end_time}`,
          teacherName: slot.teacher_name || '老师',
          deadline: dayjs(`${slot.lesson_date} ${slot.start_time}`)
            .subtract(1, 'hour')
            .toISOString(),
          campusName:
            campuses.find((c) => c.id === (slot.campus_id || currentCampusId))?.name || '校区',
          room: slot.room,
          status: created.status === 'pending' ? 'waitlist' : 'booked',
          createdAt: created.created_at || new Date().toISOString(),
        });

        await loadOpenClassSlots(dayjs(slot.lesson_date), true);
        Taro.showToast({
          title: created.status === 'pending' ? '已加入候补' : '预约成功',
          icon: 'success',
        });
      } catch (err) {
        logError('parent book open slot', err);
        Taro.showToast({ title: '预约失败', icon: 'none' });
      }
    },
    [campuses, currentCampusId, loadOpenClassSlots, profile],
  );

  /** 家长端：取消团课预约 */
  const handleParentCancelOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (!profile?.id) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      try {
        const kids = await studentService.getByParent(profile.id);
        const kidIds = new Set(kids.map((k) => k.id));
        const bookedKids = (slot.booking_students || []).filter((s) => kidIds.has(s.id));
        if (bookedKids.length === 0) {
          Taro.showToast({ title: '未预约该时段', icon: 'none' });
          return;
        }

        let student = bookedKids[0];
        if (bookedKids.length > 1) {
          const sheet = await Taro.showActionSheet({
            itemList: bookedKids.map((k) => k.name),
          });
          student = bookedKids[sheet.tapIndex];
        }

        const { confirm } = await Taro.showModal({
          title: '取消预约',
          content: `确认取消「${student.name}」该时段的预约？`,
        });
        if (!confirm) return;

        const records = await classBookingService.getRecordsBySlot(slot.id);
        const record = records.find((r) => r.student_id === student.id && r.status !== 'cancelled');
        if (record) {
          await classBookingService.removeBookingRecord(record.id);
          updateParentBookingStatus(record.id, 'cancelled');
        }
        // 兼容旧本地草稿 id
        updateParentBookingStatus(`pb-${slot.id}-${student.id}`, 'cancelled');

        await loadOpenClassSlots(dayjs(slot.lesson_date), true);
        Taro.showToast({ title: '已取消预约', icon: 'success' });
      } catch (err) {
        logError('parent cancel open slot', err);
        Taro.showToast({ title: '取消失败', icon: 'none' });
      }
    },
    [loadOpenClassSlots, profile],
  );

  /** 开放预约：左滑取消 — 将活跃/已满时段设为休息 */
  const handleCancelOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (slot.status === 'rest') return;
      try {
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
        Taro.showToast({ title: '已设为休息', icon: 'success' });
      } catch (err) {
        logError('cancel open slot', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [setOpenClassSlots],
  );

  /** 开放预约：左滑恢复 — 将休息时段恢复为活跃 */
  const handleRestoreOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (slot.status !== 'rest') return;
      try {
        await classBookingService.updateSlotStatus(slot.id, 'active');
        setOpenClassSlots((prev) => {
          const next = { ...prev };
          const dateKey = slot.lesson_date;
          if (next[dateKey]) {
            next[dateKey] = { ...next[dateKey] };
            const classSlots = next[dateKey][slot.class_id];
            if (classSlots) {
              next[dateKey][slot.class_id] = classSlots.map((s) =>
                s.id === slot.id ? { ...s, status: 'active' as const } : s,
              );
            }
          }
          return next;
        });
        Taro.showToast({ title: '已恢复开放', icon: 'success' });
      } catch (err) {
        logError('restore open slot', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [setOpenClassSlots],
  );

  return {
    handleOpenClassSlotConfig,
    handleProxyBooking,
    handleOpenSlotRollCall,
    handleEditOpenSlot,
    handleParentBookOpenSlot,
    handleParentCancelOpenSlot,
    handleCancelOpenSlot,
    handleRestoreOpenSlot,
  };
}
