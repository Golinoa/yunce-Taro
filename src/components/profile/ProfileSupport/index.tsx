/**
 * ProfileSupport - 个人中心底部服务按钮
 *
 * 固定在内容区底部，提供客服咨询、服务中心等支持入口。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';

export interface ProfileSupportProps {
  /** 客服咨询点击 */
  onCustomerService?: () => void;
  /** 服务中心点击 */
  onServiceCenter?: () => void;
  /** 额外类名 */
  className?: string;
}

const ProfileSupport: React.FC<ProfileSupportProps> = ({
  onCustomerService,
  onServiceCenter,
  className,
}) => {
  return (
    <View className={cn('mx-[32rpx] mb-[24rpx] flex gap-[20rpx]', className)}>
      {onCustomerService && (
        <View
          className="flex-1 flex items-center justify-center gap-[12rpx] py-[26rpx] rounded-[32rpx] bg-white shadow-soft active:bg-muted"
          onClick={onCustomerService}
        >
          <Icon name="mdi-headset" size="sm" color="primary" />
          <Text className="text-[28rpx] font-medium text-foreground">客服咨询</Text>
        </View>
      )}
      {onServiceCenter && (
        <View
          className="flex-1 flex items-center justify-center gap-[12rpx] py-[26rpx] rounded-[32rpx] bg-white shadow-soft active:bg-muted"
          onClick={onServiceCenter}
        >
          <Icon name="mdi-help-circle" size="sm" color="accent" />
          <Text className="text-[28rpx] font-medium text-foreground">服务中心</Text>
        </View>
      )}
    </View>
  );
};

export default ProfileSupport;
