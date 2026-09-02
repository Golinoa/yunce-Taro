/**
 * 分组小标题：主题色竖线 + 文字
 */
import { View, Text } from '@tarojs/components';
import React from 'react';

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <View className="flex flex-row items-center gap-[12rpx] pb-[24rpx]">
    <View className="w-[6rpx] h-[28rpx] rounded-[4rpx] bg-warning" />
    <Text className="text-[28rpx] font-semibold text-foreground">{title}</Text>
  </View>
);

export default SectionTitle;
