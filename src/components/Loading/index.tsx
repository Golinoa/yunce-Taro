import { View, Text } from '@tarojs/components';
import React, { useEffect, useState } from 'react';

/** 仅作为“是否值得展示加载页”的感知阈值，不控制展示总时长 */
const LOADING_APPEAR_DELAY_MS = 120;

interface LoadingProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  title?: string;
  fullScreen?: boolean;
  delayMs?: number;
}

const Loading: React.FC<LoadingProps> = ({
  text = '正在同步页面数据，请稍候',
  size = 'medium',
  title = '正在加载',
  fullScreen = false,
  delayMs = LOADING_APPEAR_DELAY_MS,
}) => {
  const [visible, setVisible] = useState(delayMs <= 0);
  const ringSize = size === 'small' ? '32rpx' : size === 'large' ? '64rpx' : '48rpx';
  const wrapperClassName = fullScreen
    ? 'min-h-screen bg-gradient-subtle px-[40rpx] flex items-center justify-center'
    : 'flex items-center justify-center px-[24rpx] py-[64rpx]';

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return undefined;
    }

    setVisible(false);
    const timer = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);

  // 极短任务不展示加载页，避免页面出现“闪一下”的割裂感
  if (!visible) {
    return null;
  }

  return (
    <View className={wrapperClassName}>
      <View
        className={`w-full rounded-[36rpx] bg-white border-[2rpx] border-solid border-border-light shadow-card ${
          fullScreen ? 'max-w-[560rpx] px-[40rpx] py-[56rpx]' : 'max-w-[520rpx] px-[32rpx] py-[40rpx]'
        }`}
      >
        <View className="flex items-center justify-between gap-[24rpx]">
          <View className="flex-1">
            <Text className="text-[32rpx] font-semibold text-foreground block">{title}</Text>
            <Text className="mt-[12rpx] text-[24rpx] leading-[1.6] text-muted-foreground block">
              {text}
            </Text>
          </View>
          <View className="relative w-[112rpx] h-[112rpx] rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <View className="absolute inset-[8rpx] rounded-full border-[2rpx] border-solid border-primary/10" />
            <View className="flex items-center justify-center animate-spin">
              <View
                className="rounded-full border-[4rpx] border-solid border-primary/15 border-t-primary"
                style={{ width: ringSize, height: ringSize }}
              />
            </View>
          </View>
        </View>

        <View className="mt-[32rpx] flex flex-col gap-[16rpx]">
          <View className="h-[20rpx] w-[72%] rounded-full bg-muted animate-pulse" />
          <View className="h-[20rpx] w-full rounded-full bg-muted animate-pulse" />
          <View className="h-[20rpx] w-[56%] rounded-full bg-muted animate-pulse" />
        </View>

        <View className="mt-[28rpx] flex items-center gap-[12rpx]">
          <View className="w-[12rpx] h-[12rpx] rounded-full bg-primary/70 animate-pulse" />
          <View className="w-[12rpx] h-[12rpx] rounded-full bg-primary/45 animate-pulse" />
          <View className="w-[12rpx] h-[12rpx] rounded-full bg-primary/25 animate-pulse" />
          <Text className="text-[22rpx] text-muted-foreground">页面内容即将呈现</Text>
        </View>
      </View>
    </View>
  );
};

export default Loading;
