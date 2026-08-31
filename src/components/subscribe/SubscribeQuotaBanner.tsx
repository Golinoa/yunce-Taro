import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import { subscribeMessageService } from '@/services/subscribe-message';

export interface SubscribeQuotaBannerProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

const SubscribeQuotaBanner: React.FC<SubscribeQuotaBannerProps> = ({
  visible,
  message,
  onDismiss,
}) => {
  if (!visible || !message) {
    return null;
  }

  const handleAction = () => {
    onDismiss();
    Taro.navigateTo({ url: subscribeMessageService.messageAuthPageUrl });
  };

  return (
    <View className="fixed left-0 right-0 top-0 z-150 px-[24rpx] pt-[env(safe-area-inset-top)]">
      <View className="mt-[8rpx] flex items-center gap-[16rpx] rounded-[16rpx] bg-warning/15 px-[24rpx] py-[20rpx]">
        <Text className="flex-1 text-[24rpx] leading-[36rpx] text-foreground">{message}</Text>
        <Text
          className="text-[24rpx] font-medium text-primary active:opacity-80"
          onClick={handleAction}
        >
          去补充
        </Text>
        <Text
          className="text-[24rpx] text-foreground-secondary active:opacity-80"
          onClick={onDismiss}
        >
          关闭
        </Text>
      </View>
    </View>
  );
};

export default SubscribeQuotaBanner;
