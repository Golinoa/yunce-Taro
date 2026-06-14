import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Icon from '@/components/Icon';
import { withRouteGuard } from '@/utils/route-guard';

const Index: React.FC = () => {
  const handleClick = () => {
    Taro.showToast({ title: '开始体验', icon: 'success' });
  };

  return (
    <View className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-subtle">
      <View className="w-full max-w-[600rpx] bg-card rounded-lg py-8 px-4 shadow-card flex flex-col items-center">
        <Icon name="mdi-rocket-launch" size="xxl" color="primary" />
        <Text className="text-[40rpx] font-bold text-foreground mt-4 mb-2 leading-tight text-center">
          欢迎使用 PAI 小程序
        </Text>
        <Text className="text-sm text-muted-foreground leading-loose text-center mb-6">
          基于 PAI 跨端技术构建的现代化小程序模板
        </Text>
        <View
          className="w-full py-3 bg-gradient-primary rounded-button flex items-center justify-center press-scale"
          onClick={handleClick}
        >
          <Text className="text-lg font-medium text-white">开始体验</Text>
        </View>
      </View>
    </View>
  );
};

export default withRouteGuard(Index);
