/**
 * 表单单元格组件
 *
 * 左标签 + 右内容/输入框的列表式表单行。
 * 适用于详情页、设置页等需要标签与值左右对齐的场景。
 */
import { View, Text, Input, type InputProps } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';

export interface FormCellProps {
  /** 左侧标签 */
  label: string;
  /** 占位文字（editable 为 true 时生效） */
  placeholder?: string;
  /** 当前值（editable 为 true 时作为 input value） */
  value?: string;
  /** 值变更回调 */
  onChange?: (value: string) => void;
  /** 是否可编辑（使用 Input） */
  editable?: boolean;
  /** 是否禁用（只读展示） */
  disabled?: boolean;
  /** 是否显示右侧箭头 */
  showArrow?: boolean;
  /** 是否显示底部分隔线 */
  divider?: boolean;
  /** 自定义右侧节点（优先级最高） */
  children?: React.ReactNode;
  /** input 类型 */
  type?: InputProps['type'];
  /** 最大长度 */
  maxlength?: number;
  /** 整行点击回调（editable 为 false 时生效） */
  onClick?: () => void;
  className?: string;
}

const FormCell: React.FC<FormCellProps> = ({
  label,
  placeholder,
  value,
  onChange,
  editable = true,
  disabled = false,
  showArrow = false,
  divider = true,
  children,
  type,
  maxlength,
  onClick,
  className,
}) => {
  const renderRight = () => {
    if (children) return children;

    if (editable && !disabled) {
      return (
        <Input
          className="flex-1 text-right text-[30rpx] text-foreground placeholder:text-muted-foreground bg-transparent"
          value={value}
          placeholder={placeholder}
          onInput={(e) => onChange?.(e.detail.value)}
          type={type}
          maxlength={maxlength}
        />
      );
    }

    return (
      <Text
        className={cn('text-[30rpx] truncate', value ? 'text-foreground' : 'text-muted-foreground')}
      >
        {value || placeholder || ''}
      </Text>
    );
  };

  return (
    <View
      className={cn(
        'flex flex-row items-center justify-between py-[28rpx]',
        divider && 'border-b-[2rpx] border-border/50',
        onClick && 'press-bg',
        className,
      )}
      onClick={onClick}
    >
      <Text className="text-[30rpx] text-foreground whitespace-nowrap mr-[24rpx]">{label}</Text>
      <View className="flex flex-row items-center justify-end flex-1 min-w-0 gap-[8rpx]">
        {renderRight()}
        {showArrow && <Icon name="mdi-chevron-right" size={32} color="muted" />}
      </View>
    </View>
  );
};

export default FormCell;
