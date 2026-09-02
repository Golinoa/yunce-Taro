/**
 * 排课表单：底部固定保存栏（Q2-3）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export type ScheduleFormFooterProps = {
  canSubmit: boolean;
  submitBlockedReason: string;
  saving: boolean;
  deleting: boolean;
  isEdit: boolean;
  isRescheduleMode: boolean;
  onSave: () => void;
};

const ScheduleFormFooter: React.FC<ScheduleFormFooterProps> = ({
  canSubmit,
  submitBlockedReason,
  saving,
  deleting,
  isEdit,
  isRescheduleMode,
  onSave,
}) => (
  <View className="fixed bottom-0 left-0 right-0 z-200 border-t border-border bg-white px-[28rpx] pt-[10rpx] pb-safe-bar">
    {!canSubmit && submitBlockedReason && (
      <View className="absolute left-[28rpx] right-[28rpx] top-[-56rpx] z-200 rounded-[16rpx] bg-white px-[20rpx] py-[12rpx] shadow-soft">
        <Text className="text-[24rpx] text-muted-foreground">{submitBlockedReason}</Text>
      </View>
    )}
    <View
      className={cn(
        'flex h-[80rpx] w-full items-center justify-center rounded-full',
        !canSubmit || saving || deleting ? 'bg-muted' : 'bg-primary',
      )}
      onClick={!canSubmit || saving || deleting ? undefined : onSave}
    >
      <Text
        className={cn(
          'text-[30rpx] font-medium',
          !canSubmit || saving || deleting ? 'text-muted-foreground' : 'text-primary-foreground',
        )}
      >
        {saving ? '保存中...' : isEdit ? (isRescheduleMode ? '确认调课' : '保存修改') : '保存'}
      </Text>
    </View>
  </View>
);

export default ScheduleFormFooter;
