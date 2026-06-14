import { View, Text } from '@tarojs/components';
import React from 'react';

interface CircleCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

const CircleCheckbox: React.FC<CircleCheckboxProps> = ({ checked, onChange }) => {
  return (
    <View
      className={`w-[44rpx] h-[44rpx] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-transparent'}`}
      onClick={(e) => {
        e.stopPropagation?.();
        onChange?.(!checked);
      }}
    >
      {checked && <Text className="text-white text-xs font-bold leading-none">✓</Text>}
    </View>
  );
};

export default CircleCheckbox;
