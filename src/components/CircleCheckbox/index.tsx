import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface CircleCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** 尺寸，单位 rpx，默认 44 */
  size?: number;
  className?: string;
}

const CircleCheckbox: React.FC<CircleCheckboxProps> = ({
  checked,
  onChange,
  size = 44,
  className,
}) => {
  return (
    <View
      className={cn(
        'rounded-full border-2 flex items-center justify-center flex-shrink-0 transition',
        checked ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-transparent',
        className,
      )}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
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
