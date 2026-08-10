/**
 * PickerSheet - 底部单列滚轮选择弹窗
 *
 * 使用原生 PickerView 实现上下滑动选择，固定高度 420rpx。
 * 支持顶部取消/标题/确认栏，以及底部取消按钮两种模式。
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface PickerOption {
  label: string;
  value: string;
}

interface PickerSheetProps {
  visible: boolean;
  title?: string;
  options: PickerOption[];
  value?: string;
  confirmText?: string;
  cancelText?: string;
  /** 是否显示顶部取消/标题/确认栏 */
  showHeader?: boolean;
  /** 是否在底部显示取消按钮（无顶部栏时使用） */
  showFooterCancel?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

const PickerSheet: React.FC<PickerSheetProps> = ({
  visible,
  title,
  options,
  value,
  confirmText = '确认',
  cancelText = '取消',
  showHeader = true,
  showFooterCancel = false,
  onClose,
  onConfirm,
}) => {
  const initialIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setSelectedIndex(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
    }
  }, [visible, value, options]);

  const handleChange = (e: { detail: { value: number[] } }) => {
    setSelectedIndex(e.detail.value[0] ?? 0);
  };

  const handleConfirm = () => {
    const option = options[selectedIndex];
    if (option) {
      onConfirm(option.value);
    }
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      scrollable={false}
      className="rounded-t-[32rpx]"
    >
      <View className="bg-white">
        {showHeader && (
          <View className="flex flex-shrink-0 items-center justify-between px-[32rpx] py-[24rpx]">
            <Text
              className="text-[32rpx] text-foreground-secondary active:opacity-70"
              onClick={onClose}
            >
              {cancelText}
            </Text>
            {title && <Text className="text-[34rpx] font-medium text-foreground">{title}</Text>}
            <Text className="text-[32rpx] text-primary active:opacity-70" onClick={handleConfirm}>
              {confirmText}
            </Text>
          </View>
        )}

        <PickerView
          className="h-[480rpx]"
          indicatorStyle="height: 96rpx; line-height: 96rpx;"
          value={[selectedIndex]}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {options.map((option) => (
              <View key={option.value} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{option.label}</Text>
              </View>
            ))}
          </PickerViewColumn>
        </PickerView>

        {showFooterCancel && (
          <View
            className="center flex-shrink-0 border-t border-border py-[26rpx] active:bg-muted"
            onClick={onClose}
          >
            <Text className="text-[32rpx] text-foreground">{cancelText}</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default PickerSheet;
