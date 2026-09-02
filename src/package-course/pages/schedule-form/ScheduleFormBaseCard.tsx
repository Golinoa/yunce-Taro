/**
 * 排课表单：基础信息卡（Q2-3）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import Stepper from '@/components/Stepper';
import {
  AUTO_OPEN_OPTIONS,
  SCHEDULE_TYPE_OPTIONS,
  SLOT_MAX_COUNT_OPTIONS,
  type AutoOpenType,
} from './schedule-form-constants';

export type ScheduleFormBaseCardProps = {
  isGroupMode: boolean;
  selectedClassName?: string;
  selectedTeachingTeacherId: string;
  selectedAssistantTeacherId: string;
  teachingTeacherName?: string;
  assistantTeacherName?: string;
  classLevelLabel: string;
  selectedRoomName: string;
  hasRooms: boolean;
  consumedHours: number;
  autoOpenType: AutoOpenType;
  slotMaxCount: number;
  minOpenCount: number;
  onOpenTypePicker: () => void;
  onOpenClassPicker: () => void;
  onOpenTeacherPicker: () => void;
  onOpenAssistantPicker: () => void;
  onOpenLevelPicker: () => void;
  onOpenRoomPicker: () => void;
  onConsumedHoursChange: (value: number) => void;
  onAutoOpenTypeChange: (value: AutoOpenType) => void;
  onSlotMaxCountChange: (value: number) => void;
  onMinOpenCountChange: (value: number) => void;
};

const ScheduleFormBaseCard: React.FC<ScheduleFormBaseCardProps> = ({
  isGroupMode,
  selectedClassName,
  selectedTeachingTeacherId,
  selectedAssistantTeacherId,
  teachingTeacherName,
  assistantTeacherName,
  classLevelLabel,
  selectedRoomName,
  hasRooms,
  consumedHours,
  autoOpenType,
  slotMaxCount,
  minOpenCount,
  onOpenTypePicker,
  onOpenClassPicker,
  onOpenTeacherPicker,
  onOpenAssistantPicker,
  onOpenLevelPicker,
  onOpenRoomPicker,
  onConsumedHoursChange,
  onAutoOpenTypeChange,
  onSlotMaxCountChange,
  onMinOpenCountChange,
}) => (
  <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card">
    <View className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]">
      <Text className="text-[28rpx] text-foreground">课程类型</Text>
      <View className="flex items-center gap-[8rpx]" onClick={onOpenTypePicker}>
        <Text className="text-[28rpx] text-foreground">
          {SCHEDULE_TYPE_OPTIONS[isGroupMode ? 1 : 0]}
        </Text>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>

    <View className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]">
      <Text className="text-[28rpx] text-foreground">班级名称</Text>
      <View className="flex items-center gap-[8rpx]" onClick={onOpenClassPicker}>
        <Text
          className={cn(
            'text-[28rpx]',
            selectedClassName ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {selectedClassName || '请选择'}
        </Text>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>

    <View
      className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
      onClick={onOpenTeacherPicker}
    >
      <Text className="text-[28rpx] text-foreground">老师</Text>
      <View className="flex items-center gap-[8rpx]">
        <Text
          className={cn(
            'text-[28rpx]',
            selectedTeachingTeacherId ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {teachingTeacherName || '请选择'}
        </Text>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>
    <View
      className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
      onClick={onOpenAssistantPicker}
    >
      <Text className="text-[28rpx] text-foreground">助教</Text>
      <View className="flex items-center gap-[8rpx]">
        <Text
          className={cn(
            'text-[28rpx]',
            selectedAssistantTeacherId ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {assistantTeacherName || '请选择'}
        </Text>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>
    <View
      className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
      onClick={onOpenLevelPicker}
    >
      <Text className="text-[28rpx] text-foreground">课程难度</Text>
      <View className="flex items-center gap-[8rpx]">
        <View className="rounded-[8rpx] border border-primary px-[16rpx] py-[6rpx]">
          <Text className="text-[24rpx] text-primary">{classLevelLabel}</Text>
        </View>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>

    <View
      className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
      onClick={onOpenRoomPicker}
    >
      <Text className="text-[28rpx] text-foreground">上课教室</Text>
      <View className="flex items-center gap-[8rpx]">
        <Text
          className={cn(
            'text-[28rpx]',
            selectedRoomName ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {selectedRoomName || (hasRooms ? '请选择' : '当前校区暂无教室')}
        </Text>
        <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
      </View>
    </View>

    <View
      className={cn(
        'flex items-center justify-between px-[32rpx] py-[24rpx]',
        isGroupMode ? 'border-b border-border/60' : '',
      )}
    >
      <Text className="text-[28rpx] text-foreground">消耗课时</Text>
      <Stepper
        value={consumedHours}
        min={0.5}
        max={99}
        step={0.5}
        onChange={onConsumedHoursChange}
      />
    </View>

    {isGroupMode ? (
      <>
        <View className="border-b border-border/60 px-[32rpx] py-[20rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground">预约设置</Text>
          <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground">
            与时段配置同步，保存后两边一致
          </Text>
        </View>
        <View
          className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx] active:opacity-70"
          onClick={() => {
            void Taro.showActionSheet({
              itemList: AUTO_OPEN_OPTIONS.map((item) => item.label),
            })
              .then((result) => {
                const next = AUTO_OPEN_OPTIONS[result.tapIndex]?.key;
                if (next) onAutoOpenTypeChange(next);
              })
              .catch(() => undefined);
          }}
        >
          <Text className="text-[28rpx] text-foreground">自动开班条件</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {AUTO_OPEN_OPTIONS.find((item) => item.key === autoOpenType)?.label}
            </Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>
        <View
          className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx] active:opacity-70"
          onClick={() => {
            void Taro.showActionSheet({
              itemList: [...SLOT_MAX_COUNT_OPTIONS],
            })
              .then((result) => {
                const num = Number(SLOT_MAX_COUNT_OPTIONS[result.tapIndex]);
                if (!Number.isFinite(num)) return;
                onSlotMaxCountChange(num);
                if (minOpenCount > num) onMinOpenCountChange(num);
              })
              .catch(() => undefined);
          }}
        >
          <Text className="text-[28rpx] text-foreground">每时段可约人数</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{slotMaxCount} 人</Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>
        <View
          className="flex items-center justify-between px-[32rpx] py-[24rpx] active:opacity-70"
          onClick={() => {
            const options = Array.from({ length: slotMaxCount }, (_, i) => String(i + 1));
            void Taro.showActionSheet({ itemList: options })
              .then((result) => {
                const num = Number(options[result.tapIndex]);
                if (Number.isFinite(num) && num >= 1) onMinOpenCountChange(num);
              })
              .catch(() => undefined);
          }}
        >
          <Text className="text-[28rpx] text-foreground">最少开班人数</Text>
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{minOpenCount} 人</Text>
            <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
          </View>
        </View>
      </>
    ) : null}
  </View>
);

export default ScheduleFormBaseCard;
