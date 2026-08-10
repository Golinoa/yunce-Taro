/**
 * InlineSelector - 行内选择器
 *
 * 在点击位置下方直接展开选项列表，替代底部弹窗选择器。
 * 适用于表单行内的模式切换、单选场景。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';

export interface InlineSelectorOption {
  label: string;
  value: string;
}

export interface InlineSelectorProps {
  /** 选项列表 */
  options: InlineSelectorOption[];
  /** 当前选中的 value */
  value?: string;
  /** 选择变化回调 */
  onChange: (value: string) => void;
  /** 触发区域左侧标签（可选） */
  label?: string;
  /** 自定义触发区域（与 label 二选一） */
  trigger?: React.ReactNode;
  /** 占位文案 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外类名 */
  className?: string;
}

const InlineSelector: React.FC<InlineSelectorProps> = ({
  options,
  value,
  onChange,
  label,
  trigger,
  placeholder = '请选择',
  disabled = false,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.value === value)?.label || '';
  }, [options, value]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setExpanded((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setExpanded(false);
    },
    [onChange],
  );

  return (
    <View className={cn('flex flex-col', className)}>
      {/* 触发区域 */}
      <View
        className={cn(
          'flex items-center justify-between',
          !disabled && 'press-scale',
          trigger ? '' : 'py-[24rpx]',
        )}
        onClick={handleToggle}
      >
        {trigger || (
          <>
            <Text className="text-[30rpx] text-foreground whitespace-nowrap">{label}</Text>
            <View className="flex items-center gap-[8rpx]">
              <Text
                className={cn(
                  'text-[30rpx]',
                  selectedLabel ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {selectedLabel || placeholder}
              </Text>
              <Icon
                name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                size={28}
                className="text-muted-foreground"
              />
            </View>
          </>
        )}
      </View>

      {/* 展开的选项列表 */}
      {expanded && (
        <View className="mt-[16rpx] rounded-[20rpx] bg-primary-5 overflow-hidden">
          {options.map((o, idx) => {
            const active = o.value === value;
            return (
              <View
                key={o.value}
                className={cn(
                  'flex items-center justify-between px-[28rpx] py-[22rpx] press-bg',
                  idx !== options.length - 1 && 'border-b border-border/30',
                  active && 'bg-primary/10',
                )}
                onClick={() => handleSelect(o.value)}
              >
                <Text
                  className={cn(
                    'text-[28rpx]',
                    active ? 'font-medium text-primary' : 'text-foreground',
                  )}
                >
                  {o.label}
                </Text>
                {active && <Icon name="mdi-check" size={24} className="text-primary" />}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default InlineSelector;
