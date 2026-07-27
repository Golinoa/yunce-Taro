import { View, Text } from '@tarojs/components';
import React from 'react';
import QuestionHint from '@/components/QuestionHint';

export interface WorkflowHeaderCardProps {
  eyebrow: string;
  title: string;
  tone?: 'blue' | 'green';
  hintLines?: string[];
  children?: React.ReactNode;
}

const HEADER_CLASS_MAP: Record<NonNullable<WorkflowHeaderCardProps['tone']>, string> = {
  blue: 'bg-[linear-gradient(135deg,#4f7cff_0%,#6ba7ff_100%)]',
  green: 'bg-[linear-gradient(135deg,#17b26a_0%,#36c28d_100%)]',
};

const WorkflowHeaderCard: React.FC<WorkflowHeaderCardProps> = ({
  eyebrow,
  title,
  tone = 'blue',
  hintLines,
  children,
}) => {
  return (
    <View className="overflow-hidden rounded-[30rpx] bg-white shadow-card">
      <View className={`${HEADER_CLASS_MAP[tone]} px-[24rpx] py-[26rpx]`}>
        <View className="flex items-center justify-between">
          <View>
            <Text className="block text-[24rpx] text-white/75">{eyebrow}</Text>
            <Text className="mt-[8rpx] block text-[36rpx] font-semibold text-white">{title}</Text>
          </View>
          {hintLines?.length ? <QuestionHint lines={hintLines} /> : null}
        </View>
      </View>

      {children ? <View className="px-[24rpx] py-[24rpx]">{children}</View> : null}
    </View>
  );
};

export default WorkflowHeaderCard;
