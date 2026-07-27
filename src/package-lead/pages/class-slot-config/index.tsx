/**
 * 班级开放时段配置页
 *
 * 从排课页「开放预约」Tab 点击班级进入，用于：
 * - 查看/选择可预约日期
 * - 配置该日可约时段、最大人数、自动开班条件
 * - 模拟家长预约 / 将时段设为休息/取消休息
 * - 保存后自动触发约满/到时间开班
 */
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { BRAND_LOGO } from '@/constants/brand';
import { classBookingService, classService } from '@/services';
import type { Class, ClassBookingSlot } from '@/types/class';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  classId?: string;
  date?: string;
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

const AUTO_OPEN_OPTIONS: { key: ClassBookingSlot['auto_open_type']; label: string }[] = [
  { key: 'manual', label: '手动开班' },
  { key: 'full', label: '约满开班' },
  { key: 'time', label: '到时间自动开班' },
  { key: 'full_or_time', label: '约满或到时间' },
];

const ClassSlotConfigPage: React.FC = () => {
  const { profile } = useAuth();
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [slots, setSlots] = useState<ClassBookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  /** 多选时间集合 */
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  /** 页面级默认配置：新增/保存时应用到所有 active/full 时段 */
  const [defaultMaxCount, setDefaultMaxCount] = useState(6);
  const [defaultMinOpenCount, setDefaultMinOpenCount] = useState(5);
  const [defaultAutoOpenType, setDefaultAutoOpenType] =
    useState<ClassBookingSlot['auto_open_type']>('full');

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({ classId: opt.classId, date: opt.date });
    if (opt.date) {
      setSelectedDate(dayjs(opt.date));
    }
  });

  const loadClassInfo = useCallback(async () => {
    if (!params.classId) return;
    try {
      const info = await classService.getById(params.classId);
      if (info) {
        setClassInfo(info);
        setDefaultMaxCount(info.student_count > 0 ? info.student_count : 6);
        setDefaultMinOpenCount(info.min_open_count || info.student_count || 5);
        setDefaultAutoOpenType(info.auto_open_type || 'full');
      }
    } catch {
      Taro.showToast({ title: '班级信息加载失败', icon: 'none' });
    }
  }, [params.classId]);

  const loadSlots = useCallback(async () => {
    if (!params.classId) return;
    setLoading(true);
    try {
      const list = await classBookingService.getSlotsByClass(
        params.classId,
        selectedDate.format('YYYY-MM-DD'),
      );
      setSlots(list);
      setSelectedTimes(new Set());
    } catch {
      Taro.showToast({ title: '时段加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [params.classId, selectedDate]);

  useEffect(() => {
    void loadClassInfo();
  }, [loadClassInfo]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const weekDates = useMemo(() => {
    const start = dayjs().startOf('week').add(1, 'day');
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }, []);

  const slotByTime = useMemo(() => {
    return slots.reduce<Record<string, ClassBookingSlot>>((acc, slot) => {
      acc[slot.start_time] = slot;
      return acc;
    }, {});
  }, [slots]);

  /** 选中项中是否有「休」 */
  const hasRestSelected = useMemo(() => {
    for (const time of selectedTimes) {
      const slot = slotByTime[time];
      if (slot?.status === 'rest') return true;
    }
    return false;
  }, [selectedTimes, slotByTime]);

  /** 选中项中是否有非「休」 */
  const hasNonRestSelected = useMemo(() => {
    for (const time of selectedTimes) {
      const slot = slotByTime[time];
      if (slot?.status !== 'rest') return true;
    }
    return false;
  }, [selectedTimes, slotByTime]);

  const isSingleSelected = selectedTimes.size === 1;
  const isAnySelected = selectedTimes.size >= 1;
  const isAllRest = hasRestSelected && !hasNonRestSelected;
  const isAllNonRest = hasNonRestSelected && !hasRestSelected;

  const leftBtnActive = isSingleSelected;
  const rightBtnActive = isAnySelected && (isAllRest || isAllNonRest);

  const getSlotTag = useCallback(
    (time: string): 'none' | 'rest' | 'full' | 'opened' => {
      const slot = slotByTime[time];
      if (!slot) return 'none';
      if (slot.opened_schedule_id) return 'opened';
      if (slot.status === 'rest') return 'rest';
      if (slot.status === 'full') return 'full';
      return 'none';
    },
    [slotByTime],
  );

  const handleToggleTime = useCallback(
    (time: string) => {
      const tag = getSlotTag(time);
      if (tag === 'opened') {
        Taro.showToast({ title: '已生成课节，请返回排课页点名', icon: 'none' });
        return;
      }
      setSelectedTimes((prev) => {
        const next = new Set(prev);
        if (next.has(time)) {
          next.delete(time);
        } else {
          next.add(time);
        }
        return next;
      });
    },
    [getSlotTag],
  );

  const handleProxyBooking = useCallback(async () => {
    if (!isSingleSelected) return;
    const [time] = [...selectedTimes];
    const slot = slotByTime[time];
    if (!slot || slot.status === 'rest' || slot.opened_schedule_id) return;

    const studentId = profile?.id ? `student-${profile.id.slice(-4)}` : 'student-001';
    try {
      await classBookingService.addBookingRecord(slot.id, studentId);
      setSlots((prev) =>
        prev.map((item) =>
          item.id === slot.id
            ? {
                ...item,
                current_count: item.current_count + 1,
                status: item.current_count + 1 >= item.max_count ? 'full' : item.status,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      setSelectedTimes(new Set());
      Taro.showToast({ title: '已模拟预约 +1', icon: 'success' });
    } catch {
      Taro.showToast({ title: '预约失败', icon: 'none' });
    }
  }, [isSingleSelected, selectedTimes, slotByTime, profile?.id]);

  const handleToggleRest = useCallback(() => {
    if (!isAnySelected) return;

    const toRest = isAllNonRest;
    setSlots((prev) =>
      prev.map((slot) => {
        if (!selectedTimes.has(slot.start_time)) return slot;
        if (slot.opened_schedule_id) return slot;
        return {
          ...slot,
          status: toRest ? 'rest' : 'active',
          updated_at: new Date().toISOString(),
        };
      }),
    );
    setSelectedTimes(new Set());
  }, [isAllNonRest, isAnySelected, selectedTimes]);

  const handleChangeAutoOpenType = useCallback(async () => {
    const result = await Taro.showActionSheet({
      itemList: AUTO_OPEN_OPTIONS.map((item) => item.label),
    }).catch(() => null);
    if (!result) return;
    const next = AUTO_OPEN_OPTIONS[result.tapIndex]?.key;
    if (!next) return;
    setDefaultAutoOpenType(next);
    if (isAnySelected) {
      setSlots((prev) =>
        prev.map((slot) =>
          selectedTimes.has(slot.start_time) && !slot.opened_schedule_id
            ? { ...slot, auto_open_type: next, updated_at: new Date().toISOString() }
            : slot,
        ),
      );
    }
  }, [isAnySelected, selectedTimes]);

  const handleChangeMaxCount = useCallback(async () => {
    const result = await Taro.showActionSheet({
      itemList: ['1', '2', '3', '4', '5', '6', '8', '10', '12', '15', '20'],
    }).catch(() => null);
    if (!result) return;
    const num = Number(
      ['1', '2', '3', '4', '5', '6', '8', '10', '12', '15', '20'][result.tapIndex],
    );
    setDefaultMaxCount(num);
    if (isAnySelected) {
      setSlots((prev) =>
        prev.map((slot) => {
          if (!selectedTimes.has(slot.start_time) || slot.opened_schedule_id) return slot;
          const nextCount = Math.min(slot.current_count, num);
          return {
            ...slot,
            max_count: num,
            current_count: nextCount,
            status: nextCount >= num ? 'full' : 'active',
            updated_at: new Date().toISOString(),
          };
        }),
      );
    }
  }, [isAnySelected, selectedTimes]);

  const handleChangeMinOpenCount = useCallback(async () => {
    const options = Array.from({ length: defaultMaxCount }, (_, i) => String(i + 1));
    const result = await Taro.showActionSheet({ itemList: options }).catch(() => null);
    if (!result) return;
    const num = Number(options[result.tapIndex]);
    setDefaultMinOpenCount(num);
  }, [defaultMaxCount]);

  const handleSave = useCallback(async () => {
    const classId = params.classId;
    if (!classId) return;
    setSaving(true);
    try {
      // 将当前网格中所有已存在的 slot 与选中但尚未创建的时间合并
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const nextSlots: Omit<ClassBookingSlot, 'id'>[] = [];

      TIME_OPTIONS.forEach((time) => {
        const existing = slotByTime[time];
        if (existing) {
          nextSlots.push({
            ...existing,
            auto_open_type: existing.auto_open_type || defaultAutoOpenType,
            max_count: existing.max_count || defaultMaxCount,
          });
          return;
        }
        if (selectedTimes.has(time)) {
          nextSlots.push({
            class_id: classId,
            class_name: classInfo?.name,
            campus_id: classInfo?.campus_id || '',
            teacher_id: classInfo?.teacher_id || '',
            teacher_name:
              classInfo?.teachers
                ?.map((id) => (profile?.teacher_profile?.id === id ? profile?.name : undefined))
                .filter(Boolean)
                .join('、') ||
              classInfo?.teacher_id ||
              '',
            lesson_date: dateStr,
            start_time: time,
            end_time: dayjs(`2000-01-01 ${time}`).add(30, 'minute').format('HH:mm'),
            max_count: defaultMaxCount,
            current_count: 0,
            status: 'active',
            auto_open_type: defaultAutoOpenType,
            room: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });

      await classBookingService.saveClassDaySlots(classId, dateStr, nextSlots);
      const openedIds = await classBookingService.autoOpenSlotsIfNeeded(classId, dateStr);

      if (openedIds.length > 0) {
        Taro.setStorageSync('yunce:schedule:refresh', true);
      }

      Taro.showToast({
        title: `已保存${openedIds.length > 0 ? '，已自动开班' : ''}`,
        icon: 'success',
      });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    params.classId,
    selectedDate,
    slotByTime,
    selectedTimes,
    defaultAutoOpenType,
    defaultMaxCount,
    classInfo,
    profile?.teacher_profile?.id,
    profile?.name,
  ]);

  return (
    <View className="relative flex h-screen flex-col overflow-hidden bg-[linear-gradient(135deg,#ff8a4c_0%,#ffb347_100%)]">
      {/* ===== 橙色渐变头部 ===== */}
      <View className="relative flex-shrink-0">
        <View className="absolute -right-[80rpx] -top-[80rpx] h-[280rpx] w-[280rpx] rounded-full bg-white/10" />

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
            <Text className="text-[34rpx] font-semibold text-white">时段配置</Text>
            <View className="h-[80rpx] w-[80rpx]" />
          </View>
        </View>

        <View className="h-[90rpx]" />

        <View className="absolute bottom-0 left-1/2 z-20 h-[180rpx] w-[180rpx] -translate-x-1/2 translate-y-1/2">
          <View className="h-full w-full overflow-hidden rounded-full border-[8rpx] border-white bg-[#e8e8e8] shadow-[0_8rpx_32rpx_rgba(0,0,0,0.15)]">
            <Image src={BRAND_LOGO} className="h-full w-full" mode="aspectFill" />
          </View>
        </View>
      </View>

      {/* ===== 白色内容区 ===== */}
      <View className="relative z-10 -mt-[40rpx] flex flex-1 flex-col overflow-hidden rounded-t-[40rpx] bg-white">
        <View className="center mt-[138rpx]">
          <Text className="text-[38rpx] font-bold text-foreground">
            {classInfo?.name || '班级'}
          </Text>
        </View>

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
                          ? 'border-[#ff8a4c] bg-[#ff8a4c] text-white shadow-[0_4rpx_12rpx_rgba(255,138,76,0.4)]'
                          : 'border-[#c0c0c0] bg-white text-foreground shadow-[0_2rpx_8rpx_rgba(0,0,0,0.08)]',
                      )}
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedTimes(new Set());
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

            {/* 默认配置 */}
            <View className="mt-[40rpx] rounded-[20rpx] bg-[#f8fafc] px-[24rpx] py-[20rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">预约设置</Text>
              <View
                className="mt-[20rpx] flex items-center justify-between border-b border-[#eef2f7] pb-[20rpx] active:opacity-70"
                onClick={() => void handleChangeAutoOpenType()}
              >
                <Text className="text-[28rpx] text-foreground">自动开班条件</Text>
                <View className="flex items-center gap-[10rpx]">
                  <Text className="text-[26rpx] text-[#999999]">
                    {AUTO_OPEN_OPTIONS.find((item) => item.key === defaultAutoOpenType)?.label}
                  </Text>
                  <Icon name="mdi-chevron-right" size={20} color="#999999" />
                </View>
              </View>
              <View
                className="mt-[20rpx] flex items-center justify-between border-b border-[#eef2f7] pb-[20rpx] active:opacity-70"
                onClick={() => void handleChangeMaxCount()}
              >
                <Text className="text-[28rpx] text-foreground">每时段可约人数</Text>
                <View className="flex items-center gap-[10rpx]">
                  <Text className="text-[26rpx] text-[#999999]">{defaultMaxCount} 人</Text>
                  <Icon name="mdi-chevron-right" size={20} color="#999999" />
                </View>
              </View>
              <View
                className="mt-[20rpx] flex items-center justify-between active:opacity-70"
                onClick={() => void handleChangeMinOpenCount()}
              >
                <Text className="text-[28rpx] text-foreground">最少开班人数</Text>
                <View className="flex items-center gap-[10rpx]">
                  <Text className="text-[26rpx] text-[#999999]">{defaultMinOpenCount} 人</Text>
                  <Icon name="mdi-chevron-right" size={20} color="#999999" />
                </View>
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
                    const slot = slotByTime[time];
                    const tag = getSlotTag(time);
                    const isSelected = selectedTimes.has(time);
                    const countText = slot ? `${slot.current_count}/${slot.max_count}` : '';
                    return (
                      <View
                        key={time}
                        className={cn(
                          'relative center h-[90rpx] w-[calc((100%-64rpx)/5)] rounded-[12rpx] border-[4rpx] text-[26rpx] active:scale-95',
                          isSelected
                            ? 'border-[#ff8a4c] bg-[#ff8a4c] text-white shadow-[0_4rpx_12rpx_rgba(255,138,76,0.4)]'
                            : tag === 'rest'
                              ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#999999] shadow-[0_2rpx_8rpx_rgba(0,0,0,0.08)]'
                              : tag === 'full'
                                ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#999999] shadow-[0_2rpx_8rpx_rgba(0,0,0,0.08)]'
                                : tag === 'opened'
                                  ? 'border-[#c0c0c0] bg-[#e8e8e8] text-[#bbbbbb] shadow-[0_2rpx_8rpx_rgba(0,0,0,0.08)]'
                                  : 'border-[#c0c0c0] bg-white text-foreground shadow-[0_2rpx_8rpx_rgba(0,0,0,0.08)]',
                        )}
                        onClick={() => handleToggleTime(time)}
                      >
                        <Text>{time}</Text>
                        {countText ? (
                          <Text className="mt-[2rpx] text-[18rpx] opacity-80">{countText}</Text>
                        ) : null}
                        {/* 休 / 团 / 已 角标 — 三角形折角，黑底白字 */}
                        {tag !== 'none' && (
                          <View className="absolute right-0 top-0 h-[40rpx] w-[40rpx] overflow-hidden">
                            <View className="h-0 w-0 border-t-[40rpx] border-l-[40rpx] border-t-[#333333] border-l-transparent" />
                            <Text className="absolute right-[4rpx] top-[4rpx] text-[16rpx] leading-none text-white">
                              {tag === 'rest' ? '休' : tag === 'full' ? '团' : '已'}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* 底部操作栏 */}
      <View
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8e8e8] bg-white px-[30rpx] pt-[20rpx] pb-[20rpx] shadow-[0_-4rpx_20rpx_rgba(0,0,0,0.08)]"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <View className="flex items-center gap-[20rpx]">
          <View
            className={cn(
              'flex h-[76rpx] flex-1 items-center justify-center rounded-full text-[30rpx] font-medium text-white transition-all',
              leftBtnActive ? 'bg-[#ff8a4c] active:scale-95 active:bg-[#e67a3e]' : 'bg-[#e0e0e0]',
            )}
            onClick={handleProxyBooking}
          >
            代预约
          </View>
          <View
            className={cn(
              'flex h-[76rpx] flex-1 items-center justify-center rounded-full text-[30rpx] font-medium text-white transition-all',
              rightBtnActive ? 'bg-[#ff8a4c] active:scale-95 active:bg-[#e67a3e]' : 'bg-[#e0e0e0]',
            )}
            onClick={handleToggleRest}
          >
            {isAllRest ? '取消休息' : '设为休息'}
          </View>
        </View>
        <View
          className={cn(
            'mt-[16rpx] flex h-[76rpx] items-center justify-center rounded-full text-[30rpx] font-medium text-white transition-all',
            saving || loading ? 'bg-[#e0e0e0]' : 'bg-primary active:scale-95',
          )}
          onClick={() => void handleSave()}
        >
          {saving ? '保存中...' : '保存'}
        </View>
      </View>
    </View>
  );
};

export default ClassSlotConfigPage;
