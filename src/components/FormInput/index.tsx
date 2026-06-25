import { View, Text, Input, Textarea, InputProps } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * FormInput - 统一表单输入框组件
 *
 * 字号规范（对齐设计稿，提升小程序可读性）：
 * - 标签: text-sm(28rpx) font-medium
 * - 输入框: text-base(32rpx)
 * - 错误/提示: text-xs(24rpx)
 */

export interface FormInputProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onInput?: InputProps['onInput'];
  type?: InputProps['type'];
  maxlength?: number;
  placeholderClass?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  hint?: string;
  prefix?: string;
  suffix?: React.ReactNode;
  multiline?: boolean;
  minHeight?: string;
  password?: boolean;
  /** 输入框视觉变体 */
  variant?: 'default' | 'capsule';
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  required = false,
  placeholder,
  value,
  onInput,
  type,
  maxlength,
  placeholderClass,
  error,
  disabled = false,
  className,
  inputClassName,
  hint,
  prefix,
  suffix,
  multiline = false,
  minHeight = '120rpx',
  password = false,
  variant = 'default',
}) => {
  const isCapsule = variant === 'capsule';

  return (
    <View className={cn(!isCapsule && 'mb-4', className)}>
      {/* 标签行（仅 default 变体显示） */}
      {label && !isCapsule && (
        <View className="flex flex-row items-center gap-1 mb-[12rpx]">
          <Text className="text-sm text-muted-foreground font-medium">{label}</Text>
          {required && <Text className="text-base text-destructive">*</Text>}
        </View>
      )}
      {/* 输入框容器 */}
      <View
        className={cn(
          'relative w-full flex flex-row items-center',
          isCapsule
            ? 'py-[24rpx] px-[36rpx] rounded-full bg-white border-[2rpx] border-white/70 shadow-[0_12rpx_40rpx_rgba(59,110,245,0.10)]'
            : 'py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light',
          error && !isCapsule && 'border-destructive',
          disabled && 'opacity-60',
        )}
      >
        {prefix && (
          <Text className="text-base font-semibold text-muted-foreground mr-2 flex-shrink-0">
            {prefix}
          </Text>
        )}
        {multiline ? (
          <Textarea
            className={cn(
              'w-full text-base text-foreground bg-transparent leading-relaxed',
              inputClassName,
            )}
            style={{ minHeight, height: minHeight }}
            placeholder={placeholder}
            placeholderClass={placeholderClass || 'input-placeholder'}
            value={value}
            onInput={onInput}
            maxlength={maxlength}
            disabled={disabled}
          />
        ) : (
          <Input
            className={cn(
              'w-full text-base text-foreground',
              isCapsule && 'text-center',
              inputClassName,
            )}
            placeholder={placeholder}
            placeholderClass={placeholderClass || 'input-placeholder'}
            value={value}
            onInput={onInput}
            type={type}
            maxlength={maxlength}
            disabled={disabled}
            password={password}
          />
        )}
        {suffix}
      </View>
      {/* 错误提示：红色圆点! + 文字 */}
      {error && (
        <View className="flex flex-row items-center gap-1 mt-[8rpx]">
          <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
            <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
          </View>
          <Text className="text-xs text-destructive">{error}</Text>
        </View>
      )}
      {/* 提示文本 */}
      {hint && !error && <Text className="text-xs text-muted-foreground mt-[8rpx]">{hint}</Text>}
    </View>
  );
};

export default FormInput;
