import { View, Text, Switch } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { TeacherUIModel } from '@/types/teacher';
import type { TeacherBookingConfig } from '@/utils/booking-one-on-one';

/**
 * BookingControlSheet - 老师预约控制弹窗
 *
 * 家长视角预约页 FAB 点击后弹出，显示老师列表 + 开关，
 * 控制每个老师是否可被家长预约。
 */

export interface BookingControlSheetProps {
  /** 弹窗是否可见 */
  visible: boolean;
  /** 老师列表 */
  teachers: TeacherUIModel[];
  /** 预约配置映射 */
  bookingConfigs: Record<string, TeacherBookingConfig>;
  /** 切换老师预约状态回调 */
  onConfigChange: (teacherId: string, enabled: boolean) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/** 根据 booking config 状态判断是否可预约 */
function isBookable(config: TeacherBookingConfig | null | undefined): boolean {
  return config?.status === 'open';
}

/** 状态文案 */
function getStatusText(config: TeacherBookingConfig | null | undefined): string {
  if (!config || config.status === 'unset') return '未设置';
  if (config.status === 'open') return '可预约';
  return '休息中';
}

const BookingControlSheet: React.FC<BookingControlSheetProps> = ({
  visible,
  teachers,
  bookingConfigs,
  onConfigChange,
  onClose,
}) => {
  return (
    <BottomSheet
      visible={visible}
      title="老师预约控制"
      onClose={onClose}
      height="auto"
      scrollable={false}
      className="pb-safe-bar"
    >
      <View className="px-[32rpx] pb-[24rpx]">
        {/* 说明文案 */}
        <View className="mb-[24rpx] rounded-[16rpx] bg-muted px-[24rpx] py-[18rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            开关控制家长是否可以预约该老师，关闭后该老师将不会出现在家长预约列表中
          </Text>
        </View>

        {/* 老师列表 */}
        <View className="flex flex-col gap-[12rpx]">
          {teachers.map((teacher) => {
            const config = bookingConfigs[teacher.id];
            const bookable = isBookable(config);
            const statusText = getStatusText(config);

            return (
              <View
                key={teacher.id}
                className={cn(
                  'flex items-center gap-[20rpx] rounded-[16rpx] border-[2rpx] px-[24rpx] py-[22rpx]',
                  bookable ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                )}
              >
                {/* 状态圆点 */}
                <View
                  className={cn(
                    'h-[16rpx] w-[16rpx] rounded-full flex-shrink-0',
                    bookable ? 'bg-success' : 'bg-muted-foreground/40',
                  )}
                />
                {/* 老师信息 */}
                <View className="flex-1 min-w-0">
                  <Text className="text-[28rpx] font-medium text-foreground">{teacher.name}</Text>
                  <Text className="ml-[12rpx] text-[24rpx] text-muted-foreground">
                    {teacher.subject}
                  </Text>
                </View>
                {/* 状态文字 */}
                <Text
                  className={cn(
                    'text-[24rpx] flex-shrink-0',
                    bookable ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {statusText}
                </Text>
                {/* 开关 */}
                <Switch
                  checked={bookable}
                  color="#f97b6d"
                  onChange={(e) => onConfigChange(teacher.id, e.detail.value)}
                />
              </View>
            );
          })}
        </View>

        {teachers.length === 0 && (
          <View className="py-[48rpx] center">
            <Text className="text-[28rpx] text-muted-foreground">暂无老师数据</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default BookingControlSheet;
