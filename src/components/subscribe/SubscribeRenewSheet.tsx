import { View, Text } from '@tarojs/components';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface SubscribeRenewSheetProps {
  visible: boolean;
  title: string;
  body: string;
  primaryText: string;
  secondaryText: string;
  loading?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}

const SubscribeRenewSheet: React.FC<SubscribeRenewSheetProps> = ({
  visible,
  title,
  body,
  primaryText,
  secondaryText,
  loading = false,
  onPrimary,
  onSecondary,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handlePrimary = async () => {
    if (loading || submitting) return;
    setSubmitting(true);
    try {
      await onPrimary();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={busy ? undefined : onSecondary}
      height="auto"
    >
      <View className="px-[32rpx] pb-[48rpx]">
        <Text className="block text-[28rpx] leading-[44rpx] text-foreground-secondary">{body}</Text>
        <View className="mt-[32rpx] flex gap-[16rpx]">
          <View
            className={`flex-1 h-[88rpx] rounded-[16rpx] bg-muted flex items-center justify-center ${busy ? 'opacity-60' : 'active:opacity-80'}`}
            onClick={busy ? undefined : onSecondary}
          >
            <Text className="text-[28rpx] font-medium text-foreground-secondary">
              {secondaryText}
            </Text>
          </View>
          <View
            className={`flex-1 h-[88rpx] rounded-[16rpx] bg-primary flex items-center justify-center ${busy ? 'opacity-60' : 'active:opacity-90'}`}
            onClick={busy ? undefined : handlePrimary}
          >
            <Text className="text-[28rpx] font-semibold text-white">
              {busy ? '处理中...' : primaryText}
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default SubscribeRenewSheet;
