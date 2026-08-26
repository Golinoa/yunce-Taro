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
 *
 * 注意：受控模式下 onInput 必须返回 e.detail.value，否则 PC 端微信小程序
 * 可能出现输入被重置的问题。
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
  /** 输入框视觉变体
   * - default: 带背景边框的独立输入框（标签在上方）
   * - capsule: 胶囊搜索框
   * - ghost: 无背景无边框，用于 FormCell 等左标签右输入场景
   */
  variant?: 'default' | 'capsule' | 'ghost';
  /** 前缀节点，适合搜索图标等场景 */
  prefixNode?: React.ReactNode;
  /** 输入框 inline style，用于覆盖 disabled 等原生样式 */
  inputStyle?: React.CSSProperties;
  /** 是否聚焦（打开弹窗后默认聚焦标题等场景） */
  focus?: boolean;
  /** 键盘弹起时是否自动上推页面，弹窗内输入建议 false */
  adjustPosition?: boolean;
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
  prefixNode,
  inputStyle,
  focus = false,
  adjustPosition = true,
}) => {
  const isCapsule = variant === 'capsule';
  const isGhost = variant === 'ghost';

  const handleInput = (e: Parameters<NonNullable<InputProps['onInput']>>[0]) => {
    onInput?.(e);
    // 必须返回最新值，避免 PC 端受控输入框被重置
    return e.detail.value;
  };

  return (
    <View className={cn(!isCapsule && !isGhost && 'mb-4', className)}>
      {/* 标签行（仅 default 变体显示） */}
      {label && !isCapsule && !isGhost && (
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
            : isGhost
              ? 'bg-transparent py-0 px-0'
              : 'py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light',
          error && !isCapsule && !isGhost && 'border-destructive',
          disabled && !inputStyle && 'opacity-60',
        )}
      >
        {prefixNode}
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
            style={{ minHeight, height: minHeight, ...inputStyle }}
            placeholder={placeholder}
            placeholderClass={placeholderClass || 'input-placeholder'}
            value={value}
            onInput={handleInput}
            maxlength={maxlength}
            disabled={disabled}
          />
        ) : (
          <Input
            className={cn(
              'w-full text-base text-foreground',
              isCapsule && 'text-center',
              isGhost && 'text-right',
              inputClassName,
            )}
            style={inputStyle}
            placeholder={placeholder}
            placeholderClass={placeholderClass || 'input-placeholder'}
            value={value}
            onInput={handleInput}
            type={type}
            maxlength={maxlength}
            disabled={disabled}
            password={password}
            focus={focus}
            adjustPosition={adjustPosition}
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
