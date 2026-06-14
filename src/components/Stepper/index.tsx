import { View, Text } from '@tarojs/components';
import React, { useCallback } from 'react';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}

/**
 * 课时步进器
 * 设计规格：紧凑内联样式，圆角边框包裹
 * 按钮高度72rpx，中间数值区域有左右分隔线
 */
const Stepper: React.FC<StepperProps> = ({ value, min = 0.5, max = 99, step = 0.5, onChange }) => {
  const handleMinus = useCallback(() => {
    const next = Math.max(min, +(value - step).toFixed(1));
    onChange?.(next);
  }, [value, min, step, onChange]);

  const handlePlus = useCallback(() => {
    const next = Math.min(max, +(value + step).toFixed(1));
    onChange?.(next);
  }, [value, max, step, onChange]);

  return (
    <View className="inline-flex items-center border-2 border-input rounded-xl overflow-hidden bg-background self-start">
      {/* 减少按钮 */}
      <View
        className={`w-[72rpx] h-[72rpx] flex items-center justify-center transition active:bg-primary/10 ${value <= min ? 'state-disabled' : ''}`}
        onClick={handleMinus}
      >
        <Text className="text-xl text-primary font-medium">−</Text>
      </View>
      {/* 数值显示 */}
      <View className="w-[112rpx] h-[72rpx] flex items-center justify-center border-l-2 border-r-2 border-input bg-white">
        <Text className="text-base font-semibold text-foreground">{value}</Text>
      </View>
      {/* 增加按钮 */}
      <View
        className={`w-[72rpx] h-[72rpx] flex items-center justify-center transition active:bg-primary/10 ${value >= max ? 'state-disabled' : ''}`}
        onClick={handlePlus}
      >
        <Text className="text-xl text-primary font-medium">+</Text>
      </View>
    </View>
  );
};

export default Stepper;
