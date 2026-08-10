/**
 * InlineDropdown - 行内下拉选择器
 *
 * 样式：左侧橙色标题 + 右侧白色圆角选择框，点击选择框后在选择框正下方展开选项。
 * 适用于薪资规则编辑器等需要在表单行内切换模式的场景。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useMemo, useState, useCallback } from 'react';
import HintPopover from '@/components/HintPopover';
import Icon from '@/components/Icon';

export interface InlineDropdownOption {
  label: string;
  value: string;
}

export interface InlineDropdownProps {
  /** 左侧标题 */
  label: string;
  /** 选项列表 */
  options: InlineDropdownOption[];
  /** 当前选中的 value */
  value?: string;
  /** 选择变化回调 */
  onChange: (value: string) => void;
  /** 问号提示内容（可选） */
  hint?: string;
  /** 占位文案 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外类名 */
  className?: string;
}

const InlineDropdown: React.FC<InlineDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  hint,
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

  const handleClose = useCallback(() => {
    setExpanded(false);
  }, []);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setExpanded(false);
    },
    [onChange],
  );

  return (
    <View className={cn('relative flex flex-col', className)}>
      <View className="flex items-center justify-between">
        {/* 左侧标题 */}
        <View className="flex items-center gap-[8rpx] shrink-0 mr-[24rpx]">
          <Text className="text-[32rpx] font-bold text-primary leading-none">{label}</Text>
          {hint && <HintPopover content={hint} />}
        </View>

        {/* 右侧选择框 */}
        <View
          className={cn(
            'flex items-center justify-between px-[20rpx] py-[16rpx] min-w-[260rpx]',
            'bg-white border-[2rpx] border-border rounded-[16rpx] shadow-sm',
            !disabled && 'press-bg',
            expanded && 'border-primary/50',
          )}
          onClick={handleToggle}
        >
          <Text
            className={cn(
              'text-[28rpx] mr-[16rpx]',
              selectedLabel ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {selectedLabel || placeholder}
          </Text>
          <Icon
            name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
            size={24}
            className="text-muted-foreground shrink-0"
          />
        </View>
      </View>

      {/* 展开的选项列表：悬浮在选择框下方，不占用文档流 */}
      {expanded && (
        <>
          {/* 透明遮罩：点击外部关闭 */}
          <View className="fixed inset-0 z-40" onClick={handleClose} catchMove />
          <View className="absolute right-0 top-full mt-[12rpx] z-50 min-w-[260rpx]">
            <View className="bg-white border-[2rpx] border-primary/20 rounded-[16rpx] overflow-hidden shadow-popup">
              {options.map((o, idx) => {
                const active = o.value === value;
                return (
                  <View
                    key={o.value}
                    className={cn(
                      'flex items-center justify-between px-[20rpx] py-[18rpx] press-bg',
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
          </View>
        </>
      )}
    </View>
  );
};

export default InlineDropdown;
