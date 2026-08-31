/**
 * 老师试听时段配置页 package-lead/pages/trial-slot-config
 *
 * 从预约页老师 Tab 点击「管理」进入，用于为指定老师：
 * - 查看/选择可预约日期
 * - 选择/管理可预约时段
 * - 代预约学员 或 将时段设为休息/取消休息
 *
 * 时间标签状态说明：
 * - 默认：可选时段，点击选中
 * - 课：该时段老师有排课（跟班试听/单独试听），点击激活代预约
 * - 休：该时段已设为休息，点击激活取消休息
 * - 团：该时段已约满，不可点击
 */
import { View, Text, ScrollView, Image, Switch } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import { leadService, studentService, teacherService } from '@/services';
import type { TrialSlotConfig } from '@/types/lead';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import {
  createTeacherBookingConfig,
  readTeacherBookingConfig,
  writeTeacherBookingConfig,
  type TeacherBookingConfig,
} from '@/utils/booking-one-on-one';
import { logError } from '@/utils/logger';
import { upsertParentBooking } from '@/utils/parent-bookings';
import { privateBookingService } from '@/services/private-booking';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  teacherId?: string;
  /** parent=家长自约，隐藏代约/休息管理 */
  from?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

const TIME_OPTIONS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
] as const;

const COURSE_OPTIONS = [
  { id: 'course-trial-01', name: '体验课' },
  { id: 'course-trial-02', name: '试听课' },
] as const;

/** 头像直径 rpx */
const AVATAR_SIZE = 180;
const AVATAR_HALF = AVATAR_SIZE / 2;

/** 时段标签类型 */
type SlotTagType = 'none' | 'course' | 'rest' | 'full';

/** 选中项的类型 */
type SelectedSlotType = 'normal' | 'course' | 'rest';

const TrialSlotConfigPage: React.FC = () => {
  const { profile } = useAuth();
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});
  const [teacher, setTeacher] = useState<TeacherUIModel | null>(null);
  const [slots, setSlots] = useState<TrialSlotConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  /** 多选时间集合（含类型） */
  const [selectedSlots, setSelectedSlots] = useState<Map<string, SelectedSlotType>>(new Map());
  const [selectedCourseId, setSelectedCourseId] = useState<string>(COURSE_OPTIONS[0].id);

  /** 老师预约配置（每周重复、每时段可约人数等） */
  const [bookingConfig, setBookingConfig] = useState<TeacherBookingConfig | null>(null);

  /** 加载老师预约配置 */
  const loadBookingConfig = useCallback(() => {
    if (!params.teacherId || !teacher) return;
    const existing = readTeacherBookingConfig(params.teacherId);
    const config =
      existing ||
      createTeacherBookingConfig({
        teacherId: params.teacherId,
        teacherName: teacher.name,
        subject: teacher.subject,
        status: 'open',
      });
    setBookingConfig(config);
  }, [params.teacherId, teacher]);

  useEffect(() => {
    loadBookingConfig();
  }, [loadBookingConfig]);

  /** 切换每周重复开关 */
  const handleToggleWeeklyRepeat = useCallback((next: boolean) => {
    setBookingConfig((prev) => {
      if (!prev) return prev;
      const nextConfig = { ...prev, weeklyRepeat: next };
      writeTeacherBookingConfig(nextConfig);
      return nextConfig;
    });
  }, []);

  /** 修改每时段可约人数：固定 1-5 人 + 其他（自定义输入） */
  const handleChangeCapacity = useCallback(async () => {
    if (!bookingConfig) return;
    const FIXED_OPTIONS = [1, 2, 3, 4, 5];
    const result = await Taro.showActionSheet({
      itemList: [...FIXED_OPTIONS.map((n) => `${n} 人/时段`), '其他'],
    }).catch(() => null);
    if (!result) return;

    // 选了「其他」→ 弹出输入框让用户自定义
    if (result.tapIndex >= FIXED_OPTIONS.length) {
      const modalRes = await Taro.showModal({
        title: '自定义人数',
        content: '',
        confirmText: '确定',
        cancelText: '取消',
        confirmColor: '#ff8a4c',
      }).catch(() => null);
      if (!modalRes || !modalRes.confirm) return;
      const input = (modalRes as unknown as { content?: string }).content || '';
      const num = Number(input);
      // 校验：正整数，且在合理范围 1-99
      if (!Number.isInteger(num) || num < 1 || num > 99) {
        void Taro.showToast({ title: '请输入 1-99 的正整数', icon: 'none' });
        return;
      }
      setBookingConfig((prev) => {
        if (!prev) return prev;
        const nextConfig = { ...prev, capacityPerSlot: num };
        writeTeacherBookingConfig(nextConfig);
        return nextConfig;
      });
      return;
    }

    const nextCapacity = FIXED_OPTIONS[result.tapIndex];
    setBookingConfig((prev) => {
      if (!prev) return prev;
      const nextConfig = { ...prev, capacityPerSlot: nextCapacity };
      writeTeacherBookingConfig(nextConfig);
      return nextConfig;
    });
  }, [bookingConfig]);

  /** 选中项中是否有「休」类型 */
  const hasRestSelected = useMemo(() => {
    for (const type of selectedSlots.values()) {
      if (type === 'rest') return true;
    }
    return false;
  }, [selectedSlots]);

  /** 选中项中是否有非「休」类型 */
  const hasNonRestSelected = useMemo(() => {
    for (const type of selectedSlots.values()) {
      if (type !== 'rest') return true;
    }
    return false;
  }, [selectedSlots]);

  /** 是否选中了恰好 1 个时段（可代预约） */
  const isSingleSelected = selectedSlots.size === 1;
  /** 是否选中了至少 1 个时段 */
  const isAnySelected = selectedSlots.size >= 1;

  /** 选中项是否全部为「休」 */
  const isAllRest = hasRestSelected && !hasNonRestSelected;
  /** 选中项是否全部为非「休」 */
  const isAllNonRest = hasNonRestSelected && !hasRestSelected;

  /** 左侧按钮：选中恰好 1 个时激活 */
  const leftBtnActive = isSingleSelected;
  /** 右侧按钮：全休→取消休息 / 全非休→设为休息 / 混合→不激活 */
  const rightBtnActive = isAnySelected && (isAllRest || isAllNonRest);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({ teacherId: opt.teacherId, from: opt.from });
  });

  const isParentMode = params.from === 'parent';

  const loadTeacher = useCallback(async () => {
    if (!params.teacherId) return;
    try {
      const info = await teacherService.getById(params.teacherId);
      setTeacher(info);
    } catch {
      Taro.showToast({ title: '老师信息加载失败', icon: 'none' });
    }
  }, [params.teacherId]);

  const loadSlots = useCallback(async () => {
    if (!params.teacherId) return;
    setLoading(true);
    try {
      const list = await leadService.getTrialSlotConfigs(
        params.teacherId,
        profile?.currentContext?.campusId,
      );
      setSlots(list);
    } catch {
      Taro.showToast({ title: '时段加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [params.teacherId, profile?.currentContext?.campusId]);

  useEffect(() => {
    void loadTeacher();
    void loadSlots();
  }, [loadTeacher, loadSlots]);

  const weekDates = useMemo(() => {
    const start = dayjs().startOf('week').add(1, 'day');
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }, []);

  const daySlots = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    return slots.filter((s) => s.lesson_date === dateStr);
  }, [slots, selectedDate]);

  /** 左侧按钮文字：家长=预约；老师：有课=跟班试听，无课=代预约 */
  const leftBtnText = useMemo(() => {
    if (isParentMode) return '预约';
    if (!isSingleSelected) return '代预约';
    const [time] = [...selectedSlots.keys()];
    const slotType = selectedSlots.get(time);
    return slotType === 'course' ? '跟班试听' : '代预约';
  }, [isParentMode, isSingleSelected, selectedSlots]);

  const handleLeftBtnClick = useCallback(async () => {
    if (!isSingleSelected || !params.teacherId) {
      return;
    }
    const [time] = [...selectedSlots.keys()];
    const slotType = selectedSlots.get(time);
    const dateStr = selectedDate.format('YYYY-MM-DD');

    if (isParentMode) {
      if (!profile?.id) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
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
          const sheet = await Taro.showActionSheet({ itemList: kids.map((k) => k.name) });
          student = kids[sheet.tapIndex];
        }
        const endTime =
          TIME_OPTIONS[Math.min(TIME_OPTIONS.indexOf(time as (typeof TIME_OPTIONS)[number]) + 1, TIME_OPTIONS.length - 1)] ||
          time;
        const created = await privateBookingService.create({
          teacherId: params.teacherId!,
          studentId: student.id,
          lessonDate: dateStr,
          startTime: time,
          endTime,
          courseName: teacher?.subject ? `${teacher.subject}私教` : '私教课',
          teacherName: teacher?.name || '老师',
          campusId: profile.currentContext?.campusId,
        });
        // 本地镜像仅作离线展示草稿；真相源为后端 PrivateLessonBooking
        upsertParentBooking({
          id: created.id,
          userId: profile.id,
          studentId: student.id,
          studentName: student.name,
          occurrenceKey: `${params.teacherId}:${dateStr}:${time}`,
          courseId: params.teacherId,
          courseName: created.courseName || (teacher?.subject ? `${teacher.subject}私教` : '私教课'),
          courseType: 'oneOnOne',
          campusId: profile.currentContext?.campusId,
          lessonDate: dateStr,
          timeRange: `${time}-${endTime}`,
          teacherName: teacher?.name || '老师',
          deadline: dayjs(`${dateStr} ${time}`).subtract(1, 'hour').toISOString(),
          campusName: '',
          status: 'booked',
          createdAt: created.createdAt || new Date().toISOString(),
        });
        Taro.showToast({ title: '预约成功', icon: 'success' });
        setTimeout(() => {
          void Taro.navigateBack();
        }, 500);
      } catch (err) {
        logError('parent private book', err);
        const msg = err instanceof Error ? err.message : '';
        Taro.showToast({
          title: msg.includes('已预约') || msg.includes('冲突') ? msg : '预约失败',
          icon: 'none',
        });
      }
      return;
    }

    const mode = slotType === 'course' ? 'group' : 'private';
    void Taro.navigateTo({
      url:
        `/package-lead/pages/proxy-booking-form/index?teacherId=${encodeURIComponent(params.teacherId)}` +
        `&date=${encodeURIComponent(dateStr)}` +
        `&time=${encodeURIComponent(time)}&mode=${mode}`,
    });
  }, [
    isParentMode,
    isSingleSelected,
    params.teacherId,
    profile,
    selectedDate,
    selectedSlots,
    teacher?.name,
    teacher?.subject,
  ]);

  /** 有课的时段（active 状态且有排课） */
  const courseTimeSet = useMemo(() => {
    return new Set(daySlots.filter((s) => s.status === 'active').map((s) => s.start_time));
  }, [daySlots]);

  /** 约满的时段 */
  const occupiedTimeSet = useMemo(() => {
    return new Set(
      daySlots
        .filter((s) => s.status === 'active' && s.current_count >= s.max_count)
        .map((s) => s.start_time),
    );
  }, [daySlots]);

  /** 休息的时段（closed 状态） */
  const restTimeSet = useMemo(() => {
    return new Set(daySlots.filter((s) => s.status === 'closed').map((s) => s.start_time));
  }, [daySlots]);

  /** 本地休息状态（无需 API，直接切换标签显示） */
  const [localRestTimes, setLocalRestTimes] = useState<Set<string>>(new Set());

  /** 获取时段标签类型（合并本地休息状态） */
  const getSlotTag = useCallback(
    (time: string): SlotTagType => {
      if (localRestTimes.has(time) || restTimeSet.has(time)) return 'rest';
      if (occupiedTimeSet.has(time)) return 'full';
      if (courseTimeSet.has(time)) return 'course';
      return 'none';
    },
    [courseTimeSet, localRestTimes, occupiedTimeSet, restTimeSet],
  );

  const handleToggleTime = useCallback(
    (time: string) => {
      const tag = getSlotTag(time);
      if (tag === 'full') {
        return;
      }
      setSelectedSlots((prev) => {
        const next = new Map(prev);
        if (next.has(time)) {
          next.delete(time);
        } else {
          const type: SelectedSlotType =
            tag === 'rest' ? 'rest' : tag === 'course' ? 'course' : 'normal';
          next.set(time, type);
        }
        return next;
      });
    },
    [getSlotTag],
  );

  const handleRightBtnClick = useCallback(() => {
    if (isParentMode) return;
    if (!isAnySelected) return;
    if (hasRestSelected) {
      // 取消休息：将选中的休标签移除
      const times = [...selectedSlots.keys()];
      setLocalRestTimes((prev) => {
        const next = new Set(prev);
        times.forEach((t) => next.delete(t));
        return next;
      });
    } else {
      // 设为休息：将选中的时段标记为休
      const times = [...selectedSlots.keys()];
      setLocalRestTimes((prev) => {
        const next = new Set(prev);
        times.forEach((t) => next.add(t));
        return next;
      });
    }
    setSelectedSlots(new Map());
  }, [hasRestSelected, isAnySelected, isParentMode, selectedSlots]);

  return (
    <View className="relative flex h-screen flex-col overflow-hidden bg-[linear-gradient(135deg,#ff8a4c_0%,#ffb347_100%)]">
      {/* ===== 橙色渐变头部 — 状态栏 + 标题 ===== */}
      <View className="relative flex-shrink-0">
        {/* 装饰圆 */}
        <View className="absolute -right-[80rpx] -top-[80rpx] h-[280rpx] w-[280rpx] rounded-full bg-white/10" />

        {/* 状态栏 + 返回/标题 — 一体沉浸式 */}
        <View
          className="flex items-end px-[24rpx] pb-[16rpx]"
          style={{ height: `${navSafeHeight}px` }}
        >
          <View className="flex h-[72rpx] w-full items-center justify-between">
            <View
              className="flex h-[80rpx] w-[80rpx] items-center justify-center active:opacity-80"
              onClick={() => Taro.navigateBack()}
            >
              <Icon name="mdi-chevron-left" size={36} color="white" />
            </View>
            <Text className="text-[34rpx] font-semibold text-white">立即预约</Text>
            <View className="h-[80rpx] w-[80rpx]" />
          </View>
        </View>

        {/* 头像占位 — 在橙色区域内留出头像上半部分的空间 */}
        <View style={{ height: `${AVATAR_HALF}px` }} />

        {/* 头像 — 绝对定位跨在橙色/白色边界上 */}
        <View
          className="absolute left-1/2 z-20"
          style={{
            bottom: 0,
            width: `${AVATAR_SIZE}rpx`,
            height: `${AVATAR_SIZE}rpx`,
            transform: 'translate(-50%, 50%)',
          }}
        >
          <View
            className="h-full w-full overflow-hidden rounded-full border-[8rpx] border-white bg-[#e8e8e8]"
            style={{ boxShadow: '0 8rpx 32rpx rgba(0, 0, 0, 0.15)' }}
          >
            <Image src={BRAND_LOGO} className="h-full w-full" mode="aspectFill" />
          </View>
          <View
            className="absolute bottom-[6rpx] right-[6rpx] flex items-center justify-center rounded-full bg-[#ff8a4c] border-[5rpx] border-white"
            style={{
              width: `${AVATAR_SIZE * 0.22}rpx`,
              height: `${AVATAR_SIZE * 0.22}rpx`,
            }}
          >
            <Icon name="mdi-check" size={20} color="white" />
          </View>
        </View>
      </View>

      {/* ===== 白色内容区 — 圆角压在头部上方 ===== */}
      <View className="relative z-10 -mt-[40rpx] flex flex-1 flex-col overflow-hidden rounded-t-[40rpx] bg-white">
        {/* 老师姓名 — 额外上边距避免被头像压住 */}
        <View className="center" style={{ marginTop: `${AVATAR_HALF + 48}rpx` }}>
          <Text className="text-[38rpx] font-bold text-foreground">{teacher?.name || '老师'}</Text>
        </View>

        {/* 可滚动内容区 */}
        <ScrollView scrollY enhanced showScrollbar={false} className="min-h-0 flex-1">
          <View className="px-[30rpx] pb-[160rpx]">
            {/* 日期选择 */}
            <View className="mt-[48rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">日期选择</Text>
              <View className="mt-[24rpx] flex items-center justify-between">
                {weekDates.map((date, index) => {
                  const selected = date.isSame(selectedDate, 'day');
                  const isToday = date.isSame(dayjs(), 'day');
                  return (
                    <View
                      key={date.format('YYYY-MM-DD')}
                      className={cn(
                        'flex h-[124rpx] w-[88rpx] flex-col items-center justify-center rounded-[16rpx] border-[4rpx] active:scale-95',
                        selected
                          ? 'border-[#ff8a4c] bg-[#ff8a4c] text-white'
                          : 'border-[#c0c0c0] bg-white text-foreground',
                      )}
                      style={{
                        boxShadow: selected
                          ? '0 4rpx 12rpx rgba(255, 138, 76, 0.4)'
                          : '0 2rpx 8rpx rgba(0, 0, 0, 0.08)',
                      }}
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlots(new Map());
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[24rpx]',
                          selected ? 'text-white/90' : 'text-[#999999]',
                        )}
                      >
                        {WEEKDAY_LABELS[index]}
                      </Text>
                      <Text className="mt-[10rpx] text-[26rpx] font-medium">
                        {isToday ? '今日' : date.format('MM-DD')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 时间选择 */}
            <View className="mt-[40rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">时间选择</Text>
              {loading ? (
                <View className="py-10 center">
                  <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
                </View>
              ) : (
                <View className="mt-[24rpx] flex flex-wrap gap-x-[16rpx] gap-y-[20rpx]">
                  {TIME_OPTIONS.map((time) => {
                    const tag = getSlotTag(time);
                    const isSelected = selectedSlots.has(time);
                    return (
                      <View
                        key={time}
                        className={cn(
                          'relative center h-[76rpx] w-[calc((100%-64rpx)/5)] rounded-[12rpx] border-[4rpx] text-[28rpx] active:scale-95',
                          isSelected
                            ? 'border-[#ff8a4c] bg-[#ff8a4c] text-white'
                            : tag === 'rest'
                              ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#999999]'
                              : tag === 'course'
                                ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#999999]'
                                : tag === 'full'
                                  ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#bbbbbb]'
                                  : 'border-[#c0c0c0] bg-white text-foreground',
                        )}
                        style={{
                          boxShadow: isSelected
                            ? '0 4rpx 12rpx rgba(255, 138, 76, 0.4)'
                            : '0 2rpx 8rpx rgba(0, 0, 0, 0.08)',
                        }}
                        onClick={() => handleToggleTime(time)}
                      >
                        {time}
                        {/* 课 角标 — 三角形折角，黑底白字 */}
                        {tag === 'course' && (
                          <View
                            className="absolute right-0 top-0 overflow-hidden"
                            style={{ width: '40rpx', height: '40rpx' }}
                          >
                            <View
                              style={{
                                width: 0,
                                height: 0,
                                borderTop: '40rpx solid #333333',
                                borderLeft: '40rpx solid transparent',
                              }}
                            />
                            <Text className="absolute right-[4rpx] top-[4rpx] text-[16rpx] leading-none text-white">
                              课
                            </Text>
                          </View>
                        )}
                        {/* 休 角标 — 三角形折角，黑底白字 */}
                        {tag === 'rest' && (
                          <View
                            className="absolute right-0 top-0 overflow-hidden"
                            style={{ width: '40rpx', height: '40rpx' }}
                          >
                            <View
                              style={{
                                width: 0,
                                height: 0,
                                borderTop: '40rpx solid #333333',
                                borderLeft: '40rpx solid transparent',
                              }}
                            />
                            <Text className="absolute right-[4rpx] top-[4rpx] text-[16rpx] leading-none text-white">
                              休
                            </Text>
                          </View>
                        )}
                        {/* 团 角标 — 三角形折角，黑底白字 */}
                        {tag === 'full' && (
                          <View
                            className="absolute right-0 top-0 overflow-hidden"
                            style={{ width: '40rpx', height: '40rpx' }}
                          >
                            <View
                              style={{
                                width: 0,
                                height: 0,
                                borderTop: '40rpx solid #333333',
                                borderLeft: '40rpx solid transparent',
                              }}
                            />
                            <Text className="absolute right-[4rpx] top-[4rpx] text-[16rpx] leading-none text-white">
                              团
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 课程选择 */}
            <View className="mt-[40rpx] flex items-center justify-between">
              <Text className="text-[32rpx] font-semibold text-foreground">课程选择</Text>
              <View
                className="flex items-center gap-[8rpx] active:opacity-70"
                onClick={() => {
                  Taro.showActionSheet({
                    itemList: COURSE_OPTIONS.map((c) => c.name),
                    success: (res) => {
                      setSelectedCourseId(COURSE_OPTIONS[res.tapIndex]?.id || COURSE_OPTIONS[0].id);
                    },
                  });
                }}
              >
                <Text className="text-[28rpx] text-[#999999]">
                  {COURSE_OPTIONS.find((c) => c.id === selectedCourseId)?.name}
                </Text>
                <Icon name="mdi-chevron-right" size={20} color="#999999" />
              </View>
            </View>

            {/* 预约设置：每周重复 + 每时段可约人数（仅教师管理） */}
            {!isParentMode ? (
            <View className="mt-[40rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">预约设置</Text>
              <View className="mt-[24rpx] rounded-[20rpx] bg-[#f8fafc] px-[24rpx] py-[20rpx]">
                {/* 每周重复开关 */}
                <View className="flex items-center justify-between border-b border-[#eef2f7] pb-[20rpx]">
                  <View className="flex-1 pr-[20rpx]">
                    <Text className="text-[28rpx] text-foreground">每周重复</Text>
                    <Text className="mt-[6rpx] block text-[22rpx] text-[#999999]">
                      开启后当前时段配置按周自动重复
                    </Text>
                  </View>
                  <Switch
                    checked={bookingConfig?.weeklyRepeat ?? false}
                    color="#ff8a4c"
                    onChange={(e) => handleToggleWeeklyRepeat(e.detail.value)}
                  />
                </View>
                {/* 每时段可约人数 */}
                <View
                  className="flex items-center justify-between pt-[20rpx] active:opacity-70"
                  onClick={() => void handleChangeCapacity()}
                >
                  <Text className="text-[28rpx] text-foreground">每时段可约人数</Text>
                  <View className="flex items-center gap-[10rpx]">
                    <Text className="text-[26rpx] text-[#999999]">
                      {bookingConfig?.capacityPerSlot ?? 1} 人
                    </Text>
                    <Icon name="mdi-chevron-right" size={20} color="#999999" />
                  </View>
                </View>
              </View>
            </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {/* 底部操作栏 — fixed 悬浮，自适应所有屏幕 */}
      <View
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8e8e8] bg-white px-[30rpx]"
        style={{
          paddingTop: '20rpx',
          paddingBottom: '20rpx',
          marginBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4rpx 20rpx rgba(0, 0, 0, 0.08)',
        }}
      >
        <View className="flex items-center gap-[20rpx]">
          <View
            className={cn(
              'flex h-[76rpx] flex-1 items-center justify-center rounded-full text-[30rpx] font-medium text-white transition-all',
              leftBtnActive ? 'bg-[#ff8a4c] active:scale-95 active:bg-[#e67a3e]' : 'bg-[#e0e0e0]',
            )}
            onClick={() => void handleLeftBtnClick()}
          >
            {leftBtnText}
          </View>
          {!isParentMode ? (
            <View
              className={cn(
                'flex h-[76rpx] flex-1 items-center justify-center rounded-full text-[30rpx] font-medium text-white transition-all',
                rightBtnActive ? 'bg-[#ff8a4c] active:scale-95 active:bg-[#e67a3e]' : 'bg-[#e0e0e0]',
              )}
              onClick={handleRightBtnClick}
            >
              {isAllRest ? '取消休息' : '设为休息'}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default TrialSlotConfigPage;
