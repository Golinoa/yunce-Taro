/**
 * 通用阶梯行组件（底薪/提成/课时费阶梯复用）
 *
 * 布局：标签在前，输入框紧跟标签，两个字段并排，最右侧删除按钮。
 * 示例：「业绩达到：」[输入] 元，「底薪为：」[输入] 元 [删除]
 */
import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';

export interface GradientFieldDef {
  key: string;
  /** 左侧标签，如"业绩达到：" */
  label: string;
  /** 输入框后缀（单位），如"元"、"%", "元/节", "节" */
  suffix?: React.ReactNode;
  placeholder?: string;
  /** 字段级错误提示 */
  error?: string;
}

export interface GradientRowProps {
  /** 左侧标题区字段列表（1个或2个），asAddButton=true 时可省略 */
  fields?: GradientFieldDef[];
  /** 每字段对应的值 (key -> '')，asAddButton=true 时可省略 */
  values?: Record<string, string | number>;
  /** 某字段输入变化，asAddButton=true 时可省略 */
  onChange?: (key: string, raw: string) => void;
  /** 是否显示删除按钮 */
  showDelete?: boolean;
  /** 删除回调 */
  onDelete?: () => void;
  /** 最下方居中的"增加梯度"按钮模式（一行大按钮），若 true fields/values 等忽略 */
  asAddButton?: boolean;
  /** asAddButton=true 时的 onClick */
  onAdd?: () => void;
}

/** 统一输入框高度与内边距 */
const INPUT_CLASS =
  'h-[72rpx] min-w-[120rpx] flex-1 bg-muted rounded-[12rpx] px-[16rpx] text-[28rpx] text-foreground text-right';

const GradientRow: React.FC<GradientRowProps> = ({
  fields,
  values,
  onChange,
  showDelete = true,
  onDelete,
  asAddButton = false,
  onAdd,
}) => {
  const handleInput = useCallback(
    (key: string) => (e: { detail: { value: string } }) => {
      onChange?.(key, e.detail.value);
    },
    [onChange],
  );

  if (asAddButton) {
    return (
      <View className="w-full mt-[16rpx] py-[12rpx] flex items-center justify-center">
        <View
          className="px-[40rpx] py-[16rpx] rounded-full bg-primary flex items-center gap-[8rpx] press-scale"
          onClick={onAdd}
        >
          <Text className="text-[28rpx] font-semibold text-white leading-none">增加梯度</Text>
        </View>
      </View>
    );
  }

  if (!fields || !values) return null;

  return (
    <View className="flex flex-col mt-[16rpx]">
      <View className="flex items-center gap-[12rpx]">
        {fields.map((f, idx) => (
          <React.Fragment key={f.key}>
            <Text className="text-[28rpx] text-foreground whitespace-nowrap">{f.label}</Text>
            <Input
              type="digit"
              className={INPUT_CLASS}
              placeholder={f.placeholder || '0'}
              value={String(values[f.key] ?? '')}
              onInput={handleInput(f.key)}
            />
            {f.suffix && (
              <Text
                className={cn(
                  'text-[28rpx] text-muted-foreground whitespace-nowrap',
                  idx < fields.length - 1 && 'mr-[8rpx]',
                )}
              >
                {f.suffix}
              </Text>
            )}
          </React.Fragment>
        ))}
        {/* 删除 */}
        <View
          className={cn(
            'w-[56rpx] h-[56rpx] rounded-full flex items-center justify-center shrink-0',
            showDelete ? 'press-bg' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => {
            if (showDelete) onDelete?.();
          }}
        >
          <Icon name="mdi-delete-outline" size={24} className="text-muted-foreground" />
        </View>
      </View>
      {/* 字段级错误提示（只显示第一个） */}
      {fields.some((f) => f.error) && (
        <Text className="mt-[8rpx] text-[24rpx] text-error">
          {fields.find((f) => f.error)?.error}
        </Text>
      )}
    </View>
  );
};

export default GradientRow;
