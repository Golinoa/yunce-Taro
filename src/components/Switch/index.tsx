/**
 * Switch - 统一开关组件
 *
 * 用于表单中布尔值的切换，支持启用/禁用状态。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface SwitchProps {
  /** 是否开启 */
  checked: boolean;
  /** 切换回调 */
  onChange: (checked: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  className?: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false, className }) => (
  <View
    className={cn(
      'relative w-[96rpx] h-[56rpx] rounded-full transition-colors duration-200',
      checked ? 'bg-primary' : 'bg-muted',
      disabled && 'opacity-50',
      className,
    )}
    onClick={() => !disabled && onChange(!checked)}
  >
    <View
      className={cn(
        'absolute top-[4rpx] w-[48rpx] h-[48rpx] rounded-full bg-white shadow-sm transition-all duration-200',
        checked ? 'left-[44rpx]' : 'left-[4rpx]',
      )}
    />
  </View>
);

export default Switch;
