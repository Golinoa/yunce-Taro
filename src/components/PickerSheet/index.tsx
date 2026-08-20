/**
 * PickerSheet - 底部单列滚轮选择弹窗
 *
 * 使用原生 PickerView 实现上下滑动选择，固定高度 480rpx。
 * 支持顶部取消/标题/确认栏，以及底部取消按钮两种模式。
 *
 * 可选「+ 新增选项」模式（addable=true）：
 *  - 底部「+ 新增」入口，点击弹出 Taro.showModal 原生输入弹框（非内嵌输入）。
 *  - 保存后通过回调 onAdd(label) 让父组件接管选项更新与选中。
 *  - 弹窗不关闭，用户可看到新选项已加入滚轮并自动选中。
 *  - 自定义选项以标签形式展示在滚轮下方，带删除 icon（onDeleteCustom）。
 *
 * ⚠️ 微信小程序 PickerView 关键约束（曾导致"滚轮错位/不丝滑"的 bug，已修复）：
 *  - indicator-style 的高度**只能用 px 单位**，写 rpx 会被微信忽略、退回默认 34px，
 *    导致选中框高度异常、各 item 行高不一致、滚动时选中行不居中、整体不跟手。
 *  - picker-view-column 内子 view 的高度由 indicator-style 自动决定（样式里写高度无效）。
 *  因此 indicator-style 统一用 px，与设计稿 item 高度 96rpx（@375 基准 = 48px）对齐。
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';

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
  /** 是否显示「+ 新增选项」入口。开启后，弹窗底部多一行，点击弹出原生输入弹框。 */
  addable?: boolean;
  /** 新增选项时的提示文案前缀，如「年龄组」 */
  addPrompt?: string;
  /** 新增选项的输入占位文本 */
  addPlaceholder?: string;
  /** 用户输入完成回调：父组件负责把新选项并入 options、把 value 切到新项。 */
  onAdd?: (label: string) => void;
  /** 自定义选项列表（仅自定义部分），用于滚轮下方展示带删除 icon 的标签 */
  customOptions?: PickerOption[];
  /** 删除某个自定义选项 */
  onDeleteCustom?: (value: string) => void;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

/** 设计稿 item 高度 96rpx @375 基准 → 微信 PickerView 必须用 px → 48px */
const ITEM_HEIGHT_PX = 48;

const PickerSheet: React.FC<PickerSheetProps> = ({
  visible,
  title,
  options,
  value,
  confirmText = '确认',
  cancelText = '取消',
  showHeader = true,
  showFooterCancel = false,
  addable = false,
  addPrompt = '选项',
  addPlaceholder = '请输入名称',
  onAdd,
  customOptions,
  onDeleteCustom,
  onClose,
  onConfirm,
}) => {
  const computeIndex = (opts: PickerOption[], val?: string) =>
    Math.max(
      0,
      opts.findIndex((o) => o.value === val),
    );

  // 首帧（组件首次挂载）即按当前 value 定位，避免打开瞬间闪到第一项
  const [selectedIndex, setSelectedIndex] = useState(() => computeIndex(options, value));

  // 弹窗打开时同步选中位置；value 变化时也同步（新增选项后自动选中）
  useEffect(() => {
    if (!visible) return;
    setSelectedIndex(computeIndex(options, value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value, options.length]);

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

  /** 点击「+ 新增」→ 弹出原生 showModal 输入（微信 editable 模式，Taro 类型未覆盖） */
  const handleAddClick = async () => {
    if (!onAdd) return;
    // 赋值到变量可绕过对象字面量的 excess property 检查，
    // editable / placeholderText 在微信运行时生效
    const modalOption = {
      title: `新增${addPrompt}`,
      editable: true,
      placeholderText: addPlaceholder,
      confirmText: '保存',
      cancelText: '取消',
    };
    const res = await Taro.showModal(modalOption as Parameters<typeof Taro.showModal>[0]);
    const content = (res as { content?: string }).content;
    if (res.confirm && content?.trim()) {
      onAdd(content.trim());
    }
  };

  /** 删除自定义选项 */
  const handleDeleteCustom = (e: { stopPropagation: () => void }, optValue: string) => {
    e.stopPropagation();
    onDeleteCustom?.(optValue);
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
          indicatorStyle={`height: ${ITEM_HEIGHT_PX}px; line-height: ${ITEM_HEIGHT_PX}px;`}
          value={[selectedIndex]}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {options.map((option) => (
              <View key={option.value} className="center">
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

        {/* 自定义选项标签（带删除 icon） */}
        {addable && customOptions && customOptions.length > 0 && (
          <View className="flex flex-row flex-wrap gap-[16rpx] px-[32rpx] py-[20rpx] border-t border-border">
            {customOptions.map((opt) => (
              <View
                key={opt.value}
                className="flex flex-row items-center gap-[6rpx] bg-primary/10 rounded-full pl-[20rpx] pr-[8rpx] py-[8rpx] active:opacity-70"
              >
                <Text className="text-[26rpx] text-primary font-medium whitespace-nowrap">
                  {opt.label}
                </Text>
                {onDeleteCustom && (
                  <View
                    className="w-[36rpx] h-[36rpx] rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
                    onClick={(e) => handleDeleteCustom(e, opt.value)}
                  >
                    <Icon name="mdi-close" size={18} color="primary" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 「+ 新增选项」入口 */}
        {addable && (
          <View
            className="flex flex-row items-center justify-center gap-[8rpx] py-[24rpx] border-t border-border active:bg-muted"
            onClick={handleAddClick}
          >
            <Icon name="mdi-plus" size={28} color="primary" />
            <Text className="text-[30rpx] text-primary font-medium">新增{addPrompt}</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default PickerSheet;
