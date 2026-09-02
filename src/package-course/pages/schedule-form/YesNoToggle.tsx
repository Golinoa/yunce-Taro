/**
 * 是/否分段开关（Q2-3，从 schedule-form 抽出）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

const YesNoToggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => (
  <View className="flex items-center rounded-full bg-muted p-[4rpx]">
    <View
      className={cn(
        'min-w-[72rpx] rounded-full px-[20rpx] py-[10rpx] text-center transition-colors',
        value ? 'bg-primary' : 'bg-transparent',
      )}
      onClick={() => onChange(true)}
    >
      <Text
        className={cn('text-[24rpx] font-medium', value ? 'text-white' : 'text-muted-foreground')}
      >
        是
      </Text>
    </View>
    <View
      className={cn(
        'min-w-[72rpx] rounded-full px-[20rpx] py-[10rpx] text-center transition-colors',
        !value ? 'bg-[#64748B]' : 'bg-transparent',
      )}
      onClick={() => onChange(false)}
    >
      <Text
        className={cn('text-[24rpx] font-medium', !value ? 'text-white' : 'text-muted-foreground')}
      >
        否
      </Text>
    </View>
  </View>
);

export default YesNoToggle;
