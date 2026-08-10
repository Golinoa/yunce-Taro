/**
 * 薪资规则编辑器分组 Section
 *
 * 样式：
 *  - 标题行：左侧橙色标题 + 可选问号 + 右侧白色圆角选择框（InlineDropdown）
 *  - 选择后在选择框下方展开选项
 *  - 内容区域：标题下方
 *  - 底部：分割线（最后一项可隐藏）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import HintPopover from '@/components/HintPopover';
import Icon from '@/components/Icon';
import InlineDropdown from '@/components/InlineDropdown';

export interface EditorSectionProps {
  /** 左侧标题 */
  title: string;
  /** 问号提示内容 */
  hint?: string;
  /** 右侧下拉选择器的选项，不传则不显示选择器 */
  selectorOptions?: { label: string; value: string }[];
  /** 当前选中的 selector value */
  selectorValue?: string;
  /** selector 变化回调 */
  onSelectorChange?: (value: string) => void;
  /** 是否可折叠：提供 onToggle 时标题右侧显示箭头 */
  collapsible?: boolean;
  /** 当前是否展开，collapsible=true 时有效 */
  expanded?: boolean;
  /** 折叠/展开切换 */
  onToggle?: () => void;
  /** 子内容 */
  children: React.ReactNode;
  /** 是否显示底部分割线 */
  showDivider?: boolean;
  /** 额外容器类 */
  className?: string;
}

const EditorSection: React.FC<EditorSectionProps> = ({
  title,
  hint,
  selectorOptions,
  selectorValue,
  onSelectorChange,
  collapsible,
  expanded,
  onToggle,
  children,
  showDivider = true,
  className,
}) => {
  const isExpanded = collapsible ? expanded !== false : true;

  return (
    <View className={cn('flex flex-col', className)}>
      {/* 标题行 + 行内下拉选择器 */}
      {selectorOptions && selectorOptions.length > 0 ? (
        <InlineDropdown
          label={title}
          hint={hint}
          options={selectorOptions}
          value={selectorValue}
          onChange={(v) => onSelectorChange?.(v)}
        />
      ) : (
        <View className="flex items-center justify-between">
          <View className="flex items-center shrink-0 mr-[24rpx]">
            <Text className="text-[32rpx] font-bold text-primary leading-none">{title}</Text>
            {hint && <HintPopover content={hint} className="ml-[10rpx]" />}
          </View>
          {collapsible && (
            <View onClick={onToggle} className="p-[8rpx] press-scale">
              <Icon
                name={isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                size={28}
                className="text-muted-foreground"
              />
            </View>
          )}
        </View>
      )}

      {/* 内容区域 */}
      {isExpanded && <View className="mt-[20rpx]">{children}</View>}

      {/* 底部分割线 */}
      {showDivider && isExpanded && <View className="mt-[24rpx] h-[1rpx] bg-border" />}
    </View>
  );
};

export default EditorSection;
