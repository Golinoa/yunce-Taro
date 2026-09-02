/**
 * 排课表单：上课时间块（Q2-3）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { SchedulingMode, TimeSlotPair } from './schedule-form-constants';

export type ScheduleFormTimeSlotsProps = {
  title?: string;
  schedulingMode: SchedulingMode;
  hasRealTimeSlots: boolean;
  timeSlots: TimeSlotPair[];
  timeDisplayDateLabel: string;
  allowMultiTimeSlots: boolean;
  onOpenFreeCalendar: () => void;
  onOpenRuleCalendar: () => void;
  onOpenTimePicker: (slotId?: number) => void;
  onRemoveTimeSlot: (slotId: number) => void;
};

const ScheduleFormTimeSlots: React.FC<ScheduleFormTimeSlotsProps> = ({
  title = '上课时间',
  schedulingMode,
  hasRealTimeSlots,
  timeSlots,
  timeDisplayDateLabel,
  allowMultiTimeSlots,
  onOpenFreeCalendar,
  onOpenRuleCalendar,
  onOpenTimePicker,
  onRemoveTimeSlot,
}) => (
  <View
    id="schedule-time-block"
    className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[28rpx]"
  >
    <Text className="mb-[20rpx] block text-[28rpx] font-medium text-foreground">{title}</Text>
    {hasRealTimeSlots ? (
      <>
        <View className="overflow-hidden rounded-[16rpx] bg-muted/70">
          <View
            className="flex items-center justify-between border-b border-border/50 px-[24rpx] py-[22rpx]"
            onClick={() => {
              if (schedulingMode === 'free') {
                onOpenFreeCalendar();
              } else {
                onOpenRuleCalendar();
              }
            }}
          >
            <View className="flex items-center gap-[12rpx]">
              <Icon name="mdi-calendar" size={28} color="mutedForeground" />
              <Text className="text-[28rpx] text-foreground">日期</Text>
            </View>
            <View className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]">
              <Text className="text-[26rpx] text-foreground">{timeDisplayDateLabel}</Text>
            </View>
          </View>
          {timeSlots.map((ts, index) => (
            <View
              key={ts.id}
              className={cn(
                'flex items-center justify-between px-[24rpx] py-[22rpx]',
                index < timeSlots.length - 1 && 'border-b border-border/50',
              )}
            >
              <View className="flex items-center gap-[12rpx]">
                <Icon name="mdi-clock-outline" size={28} color="mutedForeground" />
                <Text className="text-[28rpx] text-foreground">
                  {timeSlots.length > 1 ? `时间${index + 1}` : '时间'}
                </Text>
              </View>
              <View className="flex items-center gap-[12rpx]">
                <View
                  className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]"
                  onClick={() => onOpenTimePicker(ts.id)}
                >
                  <Text className="text-[26rpx] text-foreground">
                    {ts.start}-{ts.end}
                  </Text>
                </View>
                {timeSlots.length > 1 ? (
                  <View
                    className="flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full bg-error/10"
                    onClick={() => onRemoveTimeSlot(ts.id)}
                  >
                    <Icon name="mdi-close" size={20} color="error" />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        <Text className="mt-[16rpx] block text-[22rpx] text-muted-foreground">
          点击上方日期或时间进行单独修改。
        </Text>
        {allowMultiTimeSlots ? (
          <View
            className="mt-[16rpx] flex items-center justify-center gap-[8rpx] py-[8rpx]"
            onClick={() => onOpenTimePicker()}
          >
            <Icon name="mdi-plus" size={28} color="primary" />
            <Text className="text-[26rpx] text-primary">添加时间段</Text>
          </View>
        ) : null}
      </>
    ) : (
      <View
        className="flex min-h-[260rpx] flex-col items-center justify-center rounded-[16rpx] border-[2rpx] border-dashed border-border bg-muted/60"
        onClick={() => onOpenTimePicker()}
      >
        <View className="flex h-[88rpx] w-[88rpx] items-center justify-center rounded-full bg-primary shadow-md">
          <Icon name="mdi-plus" size={40} color="#ffffff" />
        </View>
        <Text className="mt-[20rpx] text-[26rpx] text-muted-foreground">添加上课时间</Text>
      </View>
    )}
  </View>
);

export default ScheduleFormTimeSlots;
