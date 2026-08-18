/**
 * TagEditSheet - 门店自定义标签重命名弹窗
 *
 * 使用场景：用户在「门店标签」区长按自定义标签选择「修改」后弹出，
 * 提供受控输入框与保存按钮，对标签长度与重名做校验。
 *
 * 功能说明：
 * - 预填当前标签文本，用户可编辑后保存
 * - 空文本 / 超过字数上限 / 与已有标签重名 时给出 Toast 提示并阻断
 * - 仅当用户确实修改了文本才会触发 onConfirm
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';

interface TagEditSheetProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 当前标签文本（作为输入框初始值） */
  value: string;
  /** 其它已存在的标签（用于重名校验，排除自身），包含通用标签与其余自定义标签 */
  otherTags: string[];
  /** 单个标签字数上限，默认 5 */
  maxLength?: number;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 确认重命名回调，仅当文本合法且与旧值不同时触发 */
  onConfirm: (newName: string) => void;
}

const TagEditSheet: React.FC<TagEditSheetProps> = ({
  visible,
  value,
  otherTags,
  maxLength = 5,
  onClose,
  onConfirm,
}) => {
  const [draft, setDraft] = useState(value);

  // 每次打开时同步初始值，关闭再打开可重置
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const trimmed = draft.trim();

  const handleConfirm = useCallback(() => {
    if (!trimmed) {
      Taro.showToast({ title: '请输入标签', icon: 'none' });
      return;
    }
    if (trimmed.length > maxLength) {
      Taro.showToast({ title: `标签最多${maxLength}个字`, icon: 'none' });
      return;
    }
    if (otherTags.includes(trimmed)) {
      Taro.showToast({ title: '标签已存在', icon: 'none' });
      return;
    }
    onConfirm(trimmed);
  }, [trimmed, maxLength, otherTags, onConfirm]);

  return (
    <BottomSheet visible={visible} title="修改标签" onClose={onClose}>
      <View className="px-[32rpx] pb-[40rpx]">
        <FormInput
          label=""
          placeholder={`标签（最多${maxLength}个字）`}
          value={draft}
          onInput={(e) => setDraft(e.detail.value)}
          maxlength={maxLength}
          className="!mb-0"
        />
        <View
          className={cn(
            'mt-[32rpx] rounded-[48rpx] py-[28rpx] flex items-center justify-center',
            trimmed ? 'bg-primary press-scale' : 'bg-muted',
          )}
          onClick={trimmed ? handleConfirm : undefined}
        >
          <Text
            className={cn(
              'text-[30rpx] font-semibold',
              trimmed ? 'text-white' : 'text-muted-foreground',
            )}
          >
            保存
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default TagEditSheet;
