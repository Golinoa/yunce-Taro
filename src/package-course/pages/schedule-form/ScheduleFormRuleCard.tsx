/**
 * 排课表单：排课规则 / 自由排课卡（Q2-3）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import Icon from '@/components/Icon';
import Stepper from '@/components/Stepper';
import type { DayOfWeek } from '@/types/schedule';
import YesNoToggle from './YesNoToggle';
import {
  END_MODE_OPTIONS,
  REPEAT_OPTIONS,
  WEEKDAY_OPTIONS,
  type EndMode,
  type RepeatMode,
  type SchedulingMode,
} from './schedule-form-constants';

export type ScheduleFormRuleCardProps = {
  schedulingMode: SchedulingMode;
  startDate: string;
  repeatMode: RepeatMode;
  selectedDays: DayOfWeek[];
  endMode: EndMode;
  endDate: string;
  endCount: number;
  scheduleOnHoliday: boolean;
  freeDates: string[];
  onSchedulingModeChange: (mode: SchedulingMode) => void;
  onOpenStartCalendar: () => void;
  onRepeatModeChange: (mode: RepeatMode) => void;
  onToggleWeekday: (day: DayOfWeek) => void;
  onOpenEndModePicker: () => void;
  onOpenEndDateCalendar: () => void;
  onEndCountChange: (value: number) => void;
  onScheduleOnHolidayChange: (value: boolean) => void;
  onOpenHolidaySettings: () => void;
  onOpenFreeCalendar: () => void;
  onRemoveFreeDate: (date: string) => void;
};

const ScheduleFormRuleCard: React.FC<ScheduleFormRuleCardProps> = ({
  schedulingMode,
  startDate,
  repeatMode,
  selectedDays,
  endMode,
  endDate,
  endCount,
  scheduleOnHoliday,
  freeDates,
  onSchedulingModeChange,
  onOpenStartCalendar,
  onRepeatModeChange,
  onToggleWeekday,
  onOpenEndModePicker,
  onOpenEndDateCalendar,
  onEndCountChange,
  onScheduleOnHolidayChange,
  onOpenHolidaySettings,
  onOpenFreeCalendar,
  onRemoveFreeDate,
}) => (
  <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[28rpx]">
    <Text className="mb-[20rpx] block text-[28rpx] font-medium text-foreground">排课规则</Text>
    <View className="flex gap-[16rpx]">
      {(
        [
          { label: '规则排课', value: 'rule' as const },
          { label: '自由排课', value: 'free' as const },
        ] as const
      ).map((opt) => {
        const active = schedulingMode === opt.value;
        return (
          <View
            key={opt.value}
            className={cn(
              'flex-1 rounded-[16rpx] py-[20rpx] text-center',
              active ? 'bg-primary' : 'bg-muted',
            )}
            onClick={() => onSchedulingModeChange(opt.value)}
          >
            <Text
              className={cn('text-[28rpx] font-medium', active ? 'text-white' : 'text-foreground')}
            >
              {opt.label}
            </Text>
          </View>
        );
      })}
    </View>

    {schedulingMode === 'rule' ? (
      <View className="mt-[8rpx]">
        <View
          className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
          onClick={onOpenStartCalendar}
        >
          <Text className="text-[28rpx] text-foreground">开始日期</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-foreground">{startDate}</Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>

        <View className="border-b border-border/60 py-[24rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-foreground">重复方式</Text>
          <View className="flex gap-[12rpx]">
            {REPEAT_OPTIONS.map((opt) => {
              const active = repeatMode === opt.value;
              return (
                <View
                  key={opt.value}
                  className={cn(
                    'flex-1 rounded-full py-[14rpx] text-center',
                    active ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => onRepeatModeChange(opt.value)}
                >
                  <Text
                    className={cn('text-[26rpx]', active ? 'text-white' : 'text-foreground')}
                  >
                    {opt.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {repeatMode !== 'alternate' ? (
          <View className="border-b border-border/60 py-[24rpx]">
            <Text className="mb-[16rpx] block text-[28rpx] text-foreground">上课周几</Text>
            <View className="flex flex-wrap gap-[12rpx]">
              {WEEKDAY_OPTIONS.map((opt) => {
                const active = selectedDays.includes(opt.value);
                return (
                  <View
                    key={opt.value}
                    className={cn(
                      'h-[64rpx] w-[64rpx] rounded-full center flex items-center justify-center',
                      active ? 'bg-primary' : 'bg-muted',
                    )}
                    onClick={() => onToggleWeekday(opt.value)}
                  >
                    <Text
                      className={cn('text-[26rpx]', active ? 'text-white' : 'text-foreground')}
                    >
                      {opt.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View
          className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
          onClick={onOpenEndModePicker}
        >
          <Text className="text-[28rpx] text-foreground">结束方式</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-foreground">
              {END_MODE_OPTIONS.find((o) => o.value === endMode)?.label || '不结束'}
            </Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>

        {endMode === 'by_date' ? (
          <View
            className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
            onClick={onOpenEndDateCalendar}
          >
            <Text className="text-[28rpx] text-foreground">结束日期</Text>
            <View className="flex items-center gap-[8rpx]">
              <Text className="text-[28rpx] text-foreground">{endDate}</Text>
              <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
            </View>
          </View>
        ) : null}

        {endMode === 'by_count' ? (
          <View className="flex items-center justify-between border-b border-border/60 py-[24rpx]">
            <Text className="text-[28rpx] text-foreground">上课次数</Text>
            <Stepper value={endCount} min={1} max={999} step={1} onChange={onEndCountChange} />
          </View>
        ) : null}

        <View className="flex items-center justify-between py-[24rpx]">
          <View className="flex items-center gap-[16rpx]">
            <Text className="text-[28rpx] text-foreground">节假日是否排课</Text>
            <Text className="text-[24rpx] text-primary" onClick={onOpenHolidaySettings}>
              设置
            </Text>
          </View>
          <YesNoToggle value={scheduleOnHoliday} onChange={onScheduleOnHolidayChange} />
        </View>
      </View>
    ) : (
      <View id="schedule-free-dates" className="mt-[8rpx]">
        <View
          className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
          onClick={onOpenFreeCalendar}
        >
          <Text className="text-[28rpx] text-foreground">上课日期</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-primary">
              {freeDates.length > 0 ? `已选 ${freeDates.length} 天` : '多选日期'}
            </Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>
        {freeDates.length > 0 ? (
          <View className="flex flex-wrap gap-[12rpx] pt-[20rpx]">
            {freeDates.map((d) => (
              <View
                key={d}
                className="flex items-center gap-[8rpx] rounded-full bg-primary/10 px-[16rpx] py-[10rpx]"
                onClick={() => onRemoveFreeDate(d)}
              >
                <Text className="text-[24rpx] text-primary">{dayjs(d).format('MM/DD')}</Text>
                <Icon name="mdi-close" size={18} color="primary" />
              </View>
            ))}
            <View
              className="flex items-center gap-[6rpx] rounded-full border border-dashed border-primary/40 px-[16rpx] py-[10rpx]"
              onClick={onOpenFreeCalendar}
            >
              <Icon name="mdi-plus" size={18} color="primary" />
              <Text className="text-[24rpx] text-primary">继续选</Text>
            </View>
          </View>
        ) : null}
      </View>
    )}
  </View>
);

export default ScheduleFormRuleCard;
