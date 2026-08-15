import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import ClassAvatar from '@/components/class/ClassAvatar';
import Icon from '@/components/Icon';

/**
 * ScheduleCard - 排课卡片展示组件
 *
 * 复用课表页的班级卡片样式，支持自定义底部操作区。
 * 用于课表页、试听预约页等需要展示班级时段的场景。
 */

export interface ScheduleCardItem {
  id: string;
  classId?: string;
  className: string;
  startTime: string;
  endTime: string;
  leadTeacherName: string;
  assistantTeacherName?: string;
  note?: string;
  checkedCount: number;
  totalCount: number;
  status: 'urgent' | 'upcoming' | 'active' | 'done' | 'ended' | 'cancelled';
  countdownText?: string;
  bookingTag?: string;
  hasTrialStudent?: boolean;
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
}

export interface ScheduleCardProps {
  item: ScheduleCardItem;
  /** 卡片点击回调 */
  onClick?: (item: ScheduleCardItem) => void;
  /** 自定义底部操作区 */
  children?: React.ReactNode;
  /** 右上角更多菜单 */
  menu?: React.ReactNode;
  /** 额外类名 */
  className?: string;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  item,
  onClick,
  children,
  menu,
  className,
}) => {
  return (
    <View
      className={cn(
        'relative rounded-[14rpx] bg-card px-[24rpx] py-[22rpx] shadow-card',
        className,
      )}
      onClick={() => onClick?.(item)}
    >
      {item.status === 'cancelled' ? (
        <View className="absolute right-0 top-0 overflow-hidden rounded-tr-[14rpx]">
          <View className="bg-destructive px-[20rpx] py-[10rpx] rounded-bl-[16rpx] shadow-card">
            <Text className="text-[20rpx] font-semibold tracking-[2rpx] text-destructive-foreground">
              取消
            </Text>
          </View>
        </View>
      ) : null}

      <View className="flex items-start justify-between gap-3">
        <View className="flex items-center gap-[14rpx] flex-wrap flex-1 min-w-0">
          <ClassAvatar size="sm" />
          <View className="flex flex-1 flex-col min-w-0">
            <View className="flex items-center gap-[12rpx]">
              <Text className="text-[34rpx] font-bold text-foreground">{item.className}</Text>
              {item.bookingTag ? (
                <View className="rounded-[8rpx] bg-schedule-attend px-[12rpx] py-[4rpx]">
                  <Text className="text-center text-[20rpx] font-semibold text-primary-foreground">
                    {item.bookingTag}
                  </Text>
                </View>
              ) : null}
              {item.hasTrialStudent ? (
                <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                  <Text className="text-center text-[20rpx] font-semibold text-error">试听</Text>
                </View>
              ) : null}
            </View>
            <View className="mt-[8rpx] rounded-[8rpx] bg-primary-10 px-[12rpx] py-[6rpx] self-start">
              <Text className="text-[28rpx] font-semibold text-primary">
                {item.startTime}-{item.endTime}
              </Text>
            </View>
          </View>
        </View>
        {menu ? <View className="flex-shrink-0">{menu}</View> : null}
      </View>

      <View className="mt-[18rpx] flex items-center justify-between">
        <View className="flex min-w-0 items-center gap-[10rpx]">
          <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
          <Text className="truncate text-[28rpx] text-muted-foreground">
            {item.leadTeacherName}
            {item.assistantTeacherName ? ` / ${item.assistantTeacherName}` : ''}
          </Text>
        </View>
        <View className="flex items-center gap-[8rpx] pl-[16rpx]">
          <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
          <Text className="text-[28rpx] text-muted-foreground">
            {item.totalCount > 0 ? `${item.checkedCount}/${item.totalCount}` : '0/0'}
          </Text>
        </View>
      </View>

      {item.countdownText ? (
        <Text className="mt-[12rpx] block text-[24rpx] text-warning">{item.countdownText}</Text>
      ) : null}

      {children ? <View className="mt-[22rpx]">{children}</View> : null}
    </View>
  );
};

export default ScheduleCard;
