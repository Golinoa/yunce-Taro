import { View, Text } from '@tarojs/components';
import React from 'react';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

const Loading: React.FC<LoadingProps> = ({ text = '加载中...', size = 'medium' }) => {
  const ringSize = size === 'small' ? '32rpx' : size === 'large' ? '64rpx' : '48rpx';

  return (
    <View className="flex flex-col items-center justify-center py-12">
      <View className="flex items-center justify-center animate-spin">
        <View
          className="rounded-full border-2 border-muted border-t-primary"
          style={{ width: ringSize, height: ringSize }}
        />
      </View>
      {text && <Text className="mt-2 text-sm text-muted-foreground">{text}</Text>}
    </View>
  );
};

export default Loading;
