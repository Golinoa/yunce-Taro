/**
 * FormRow - 统一表单行组件
 *
 * 左侧标签 + 右侧值/输入框的行内布局，常用于 Card 卡片内的表单场景。
 *
 * 关键设计约束（针对微信小程序 Taro 渲染层）：
 * 1. 组件树结构在任何 props 变化时必须保持稳定，子节点数量不能变化
 * 2. 不能使用 React.Fragment (<>) 包裹会动态增减的子节点，
 *    因为 Taro reconciler 用位置索引更新子节点，Fragment 内子节点数量变化
 *    会导致位置错位 → 访问已删除节点 → _num undefined → 崩溃
 * 3. 始终渲染 Input 原生组件，通过 disabled 切换可编辑性，避免 Input ↔ Text 切换
 * 4. 条件显隐一律用 CSS（opacity-0 / hidden），不用条件渲染
 */
import { View, Text, InputProps } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import FormInput from '@/components/FormInput';
import HintPopover from '@/components/HintPopover';
import Icon from '@/components/Icon';

export interface FormRowProps {
  /** 左侧标签文案 */
  label: string;
  /** 问号提示内容 */
  hint?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否为可输入模式 */
  editable?: boolean;
  /** 输入框占位符 */
  placeholder?: string;
  /** 输入框值 */
  value?: string;
  /** 输入事件 */
  onInput?: (e: { detail: { value: string } }) => void;
  /** 输入框类型 */
  inputType?: string;
  /** 输入框后缀单位 */
  suffix?: string;
  /** 是否为多行文本 */
  multiline?: boolean;
  /** 字段错误提示 */
  error?: string;
  /** 自定义右侧内容（非 editable 模式有效，渲染时替代 FormInput） */
  children?: React.ReactNode;
  /** 点击整行回调（选择模式） */
  onClick?: () => void;
}

const FormRow: React.FC<FormRowProps> = ({
  label,
  hint,
  required = false,
  editable = false,
  placeholder,
  value,
  onInput,
  inputType,
  suffix,
  multiline = false,
  error,
  children,
  onClick,
}) => {
  // 选择器行：有自定义 children 且非编辑态（这类行不会切换 editable，安全使用条件渲染）
  const hasCustomChildren = !editable && children;

  return (
    <View className="flex flex-col border-b-[2rpx] border-border/30 py-[24rpx]">
      <View
        className={cn('flex flex-row items-center', onClick && 'press-scale')}
        onClick={onClick}
      >
        {/* 左侧标签 */}
        <View className="flex flex-row items-center shrink-0 mr-[24rpx]">
          <Text className="text-[30rpx] text-foreground whitespace-nowrap">{label}</Text>
          {required && <Text className="text-[30rpx] text-destructive ml-[4rpx]">*</Text>}
          {hint && <HintPopover content={hint} />}
        </View>

        {/* 右侧内容 - 整体用一个 View 包裹，不用 Fragment */}
        {hasCustomChildren ? (
          /* 选择器行：自定义 children + 右箭头 */
          <View className="flex-1 min-w-0 flex flex-row items-center justify-end">
            <View className="flex flex-row items-center gap-[8rpx]">
              {children}
              <View className={cn(onClick ? 'opacity-100' : 'opacity-0 h-0 w-0 overflow-hidden')}>
                <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
              </View>
            </View>
          </View>
        ) : multiline && !editable ? (
          /* 多行只读展示 */
          <View
            className="flex-1 min-w-0 bg-primary-5 rounded-[16rpx] px-[20rpx] py-[16rpx] mt-[12rpx]"
            style={{ minHeight: '120rpx' }}
          >
            <Text
              className={cn(
                'text-[30rpx] leading-relaxed',
                value ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {value || placeholder || ''}
            </Text>
          </View>
        ) : (
          /*
           * 值展示/编辑行：
           * 用 View 包裹所有子节点，确保子节点数量永远不变。
           * 始终渲染 FormInput(含 Input) + suffix Text + chevron Icon，
           * 通过 CSS 控制显隐，避免子节点数量变化导致 Taro reconciler 崩溃。
           */
          <View className="flex-1 min-w-0 flex flex-row items-center justify-end">
            <FormInput
              variant="ghost"
              className="flex-1 min-w-0"
              placeholder={editable ? placeholder || '' : ''}
              value={value}
              onInput={onInput}
              type={inputType as InputProps['type']}
              disabled={!editable}
              inputClassName={cn(
                'text-right text-[30rpx] h-[72rpx]',
                !editable && 'text-foreground',
              )}
              inputStyle={!editable ? { color: 'var(--foreground)' } : undefined}
            />
            {/* suffix 始终渲染，无 suffix 时用 opacity-0 隐藏 */}
            <Text
              className={cn(
                'text-[30rpx] text-muted-foreground ml-[8rpx] shrink-0',
                !suffix && 'opacity-0 h-0 w-0 overflow-hidden',
              )}
            >
              {suffix || ''}
            </Text>
            {/* chevron 始终渲染，非 editable + 有 onClick 时显示 */}
            <View
              className={cn(
                'shrink-0',
                !editable && onClick ? 'opacity-100' : 'opacity-0 h-0 w-0 overflow-hidden',
              )}
            >
              <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />
            </View>
          </View>
        )}
      </View>

      {/* 错误提示 - 始终渲染，用 CSS 控制显隐 */}
      <View
        className={cn(
          'flex flex-row items-center gap-[4rpx] mt-[8rpx]',
          !error && 'opacity-0 h-0 overflow-hidden',
        )}
      >
        <View className="w-[24rpx] h-[24rpx] rounded-full bg-destructive flex items-center justify-center shrink-0">
          <Text className="text-white text-[18rpx] font-bold leading-none">!</Text>
        </View>
        <Text className="text-[24rpx] text-destructive">{error || ''}</Text>
      </View>
    </View>
  );
};

export default FormRow;
