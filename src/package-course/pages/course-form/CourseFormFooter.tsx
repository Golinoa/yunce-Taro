/**
 * 课程表单底部操作栏（W2 拆页）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface CourseFormFooterProps {
  isEdit: boolean;
  saving: boolean;
  deleting: boolean;
  onSubmit: () => void;
  onDelete: () => void;
}

const CourseFormFooter: React.FC<CourseFormFooterProps> = ({
  isEdit,
  saving,
  deleting,
  onSubmit,
  onDelete,
}) => (
  <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] flex flex-col gap-[16rpx]">
    <View
      className={cn(
        'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
        saving && 'opacity-60 pointer-events-none',
      )}
      onClick={onSubmit}
    >
      <Text className="text-[30rpx] font-semibold text-white">
        {saving ? '保存中...' : isEdit ? '保存' : '确认新增'}
      </Text>
    </View>

    {isEdit && (
      <View
        className={cn(
          'w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-border flex items-center justify-center press-scale',
          deleting && 'opacity-60 pointer-events-none',
        )}
        onClick={onDelete}
      >
        <Text className="text-[30rpx] font-semibold text-destructive">
          {deleting ? '删除中...' : '删除'}
        </Text>
      </View>
    )}
  </View>
);

export default CourseFormFooter;
