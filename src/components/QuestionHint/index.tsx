import { View, Text } from '@tarojs/components';
import React, { useState } from 'react';
import Icon from '@/components/Icon';

interface QuestionHintProps {
  lines: string[];
  className?: string;
}

const QuestionHint: React.FC<QuestionHintProps> = ({ lines, className = '' }) => {
  const [visible, setVisible] = useState(false);

  return (
    <View className={`relative ${className}`}>
      <View
        className="flex h-[52rpx] w-[52rpx] items-center justify-center rounded-full bg-black/8"
        onClick={() => setVisible((prev) => !prev)}
      >
        <Icon name="mdi-help-circle" size="xs" color="white" />
      </View>

      {visible ? (
        <View className="absolute right-0 top-[68rpx] z-20 w-[420rpx] rounded-[20rpx] bg-white px-[20rpx] py-[18rpx] shadow-card">
          {lines.map((line) => (
            <Text key={line} className="block text-[24rpx] leading-[36rpx] text-foreground-secondary">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default QuestionHint;
