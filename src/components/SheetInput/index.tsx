import { View, Input, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * SheetInput - 弹窗内输入框组件
 *
 * 专门用于底部弹窗内的输入框，使用内联样式确保微信小程序兼容。
 * 解决 UnoCSS 的 hsl(var(--x)) 语法在小程序中不生效的问题。
 *
 * 颜色规范：
 * - 输入框背景：#f5faf8（浅灰绿，与白色弹窗形成对比）
 * - 边框颜色：#D5E8E0（浅灰绿边框）
 * - 错误边框：#E46767（红色）
 */

export interface SheetInputProps {
  /** 占位文本 */
  placeholder?: string;
  /** 输入值 */
  value?: string;
  /** 输入事件 */
  onInput?: (e: any) => void;
  /** 输入类型 */
  type?: 'text' | 'number' | 'digit' | 'idcard' | 'safe-password';
  /** 是否错误状态 */
  error?: boolean;
  /** 错误提示文本 */
  errorText?: string;
  /** 占位符样式类名 */
  placeholderClass?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外类名 */
  className?: string;
  /** 最大长度 */
  maxlength?: number;
  /** 焦点事件 */
  onFocus?: (e: any) => void;
  /** 失焦事件 */
  onBlur?: (e: any) => void;
}

const INPUT_STYLES = {
  normal: {
    backgroundColor: '#f5faf8',
    border: '2rpx solid #D5E8E0',
  },
  error: {
    backgroundColor: '#f5faf8',
    border: '2rpx solid #E46767',
  },
};

const SheetInput: React.FC<SheetInputProps> = ({
  placeholder = '请输入',
  value,
  onInput,
  type = 'text',
  error = false,
  errorText,
  placeholderClass = 'input-placeholder',
  disabled = false,
  className,
  maxlength = 140,
  onFocus,
  onBlur,
}) => {
  return (
    <View className={cn('w-full', className)}>
      <View
        className={cn('w-full py-[18rpx] px-6 rounded-[24rpx]', disabled && 'opacity-60')}
        style={error ? INPUT_STYLES.error : INPUT_STYLES.normal}
      >
        <Input
          className="w-full text-md h-[40rpx] leading-[40rpx]"
          placeholder={placeholder}
          placeholderClass={placeholderClass}
          value={value}
          onInput={onInput}
          type={type}
          disabled={disabled}
          maxlength={maxlength}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>
      {error && errorText && (
        <Text className="text-xs text-destructive mt-1 block">{errorText}</Text>
      )}
    </View>
  );
};

export default SheetInput;

/**
 * SheetPickerItem - 弹窗内选择器触发器组件
 *
 * 用于时间选择、日期选择等 Picker 的触发容器。
 */
export interface SheetPickerItemProps {
  /** 子内容 */
  children: React.ReactNode;
  /** 额外类名 */
  className?: string;
}

export const SheetPickerItem: React.FC<SheetPickerItemProps> = ({ children, className }) => {
  return (
    <View
      className={cn('py-[16rpx] px-5 rounded-xl text-md text-center text-foreground', className)}
      style={{ backgroundColor: '#f5faf8', border: '2rpx solid #D5E8E0' }}
    >
      {children}
    </View>
  );
};

/**
 * SheetSelectItem - 弹窗内选择触发器组件
 *
 * 用于关联选择、学员选择等带箭头的触发容器。
 */
export interface SheetSelectItemProps {
  /** 子内容 */
  children: React.ReactNode;
  /** 是否虚线边框 */
  dashed?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 额外类名 */
  className?: string;
}

export const SheetSelectItem: React.FC<SheetSelectItemProps> = ({
  children,
  dashed = false,
  onClick,
  className,
}) => {
  return (
    <View
      className={cn('flex items-center gap-4 py-[18rpx] px-6 rounded-[24rpx]', className)}
      style={{
        backgroundColor: '#f5faf8',
        border: dashed ? '2rpx dashed #D5E8E0' : '2rpx solid #D5E8E0',
      }}
      onClick={onClick}
    >
      {children}
    </View>
  );
};

/**
 * SheetTag - 弹窗内标签组件
 *
 * 用于授课模式、上课类型等标签选择。
 */
export interface SheetTagProps {
  /** 是否选中 */
  selected?: boolean;
  /** 子内容 */
  children: React.ReactNode;
  /** 点击事件 */
  onClick?: () => void;
  /** 额外类名 */
  className?: string;
}

export const SheetTag: React.FC<SheetTagProps> = ({
  selected = false,
  children,
  onClick,
  className,
}) => {
  return (
    <View
      className={cn(
        'py-3 px-6 rounded-xl text-center border-[3rpx] font-medium text-sm',
        selected ? 'border-primary bg-primary-bg text-primary' : 'text-foreground',
        className,
      )}
      style={selected ? undefined : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }}
      onClick={onClick}
    >
      {children}
    </View>
  );
};

/**
 * SheetDivider - 弹窗内分隔线组件
 */
export interface SheetDividerProps {
  /** 方向 */
  direction?: 'horizontal' | 'vertical';
  /** 额外类名 */
  className?: string;
}

export const SheetDivider: React.FC<SheetDividerProps> = ({
  direction = 'horizontal',
  className,
}) => {
  if (direction === 'vertical') {
    return (
      <View className={cn('w-[2rpx] h-4', className)} style={{ backgroundColor: '#D5E8E0' }} />
    );
  }
  return (
    <View className={cn('h-[2rpx] w-full', className)} style={{ backgroundColor: '#D5E8E0' }} />
  );
};
